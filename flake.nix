{
  description = "Mokosh — a map that looks like a map. HackYeah 2026.";

  inputs = {
    # 26.05 rather than unstable: unstable (26.11) has dropped x86_64-darwin,
    # and Intel Macs should keep working.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    flake-parts.url = "github:hercules-ci/flake-parts";

    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ self, flake-parts, treefmt-nix, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ treefmt-nix.flakeModule ];

      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem =
        { pkgs, lib, system, ... }:
        let
          # A separate nixpkgs instance with the Android SDK license accepted.
          # Kept distinct from the main package set on purpose: unfree +
          # license-accepting config should not leak into everything else.
          pkgsAndroid = import inputs.nixpkgs {
            inherit system;
            config = {
              android_sdk.accept_license = true;
              allowUnfree = true;
            };
          };
          android = import ./nix/android-sdk.nix { pkgs = pkgsAndroid; };
          # `nix fmt` runs treefmt, which drives prettier, alejandra,
          # shfmt, statix and taplo from one config.
          #
          # NOTE: treefmt matches these globs against paths relative to the
          # repo root, so everything needs the `**/` prefix — a bare `*.ts`
          # would only ever match a file sitting at the root.
          treefmtSettings = {
            settings.global.excludes = [
              "node_modules"
              ".direnv"
              "result"
              "result-*"
              "app/.expo"
              "app/android"
              "app/ios"
              "*.png"
              "*.wav"
              "*.m4a"
              "*.mp3"
              "package-lock.json"
            ];

            # `lib.mkEnableOption` defaults to *false*, so every formatter has to be
          # switched on explicitly.
          programs.alejandra = {
            enable = true;
            includes = [ "**/*.nix" ];
          };
          programs.statix = {
            enable = true;
            includes = [ "**/*.nix" ];
          };
          programs.deadnix = {
            enable = true;
            includes = [ "**/*.nix" ];
          };

          # prettier's own settings live in app/.prettierrc; only the file
          # selection is configured here.
          programs.prettier = {
            enable = true;
            includes = [ "**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,md,yml,yaml,css}" ];
          };

          programs.shfmt = {
            enable = true;
            includes = [ "**/*.sh" ];
            indent_size = 2;
          };
          # shellcheck is deliberately *not* a treefmt formatter: it does not
          # rewrite files, so including it would make `nix fmt` fail on any
          # lint finding. It runs as `checks.shellcheck` instead.
          programs.taplo = {
            enable = true;
            includes = [ "**/*.toml" ];
          };
        };

          isLinux = pkgs.stdenv.hostPlatform.isLinux;

          # The backend with its dependencies installed, used by the checks
          # below. `npm ci` happens here once rather than being repeated inside
          # each check, which would otherwise install the same tree twice.
          backendToolchain = pkgs.stdenv.mkDerivation {
            name = "mokosh-backend-deps";
            nativeBuildInputs = [ pkgs.nodejs_22 ];
            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                ./backend/package.json
                ./backend/package-lock.json
                ./backend/tsconfig.json
                ./backend/vitest.config.ts
                ./backend/src
                ./backend/tests
                ./backend/drizzle
              ];
            };
            buildPhase = ''
              runHook preBuild
              export HOME="$TMPDIR"
              export npm_config_cache="$TMPDIR/npm-cache"
              npm ci --no-audit --no-fund
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p "$out"
              cp -r . "$out/"
              runHook postInstall
            '';
            dontFixup = true;
          };

          backendFiles = lib.fileset.unions [
            ./backend/package.json
            ./backend/package-lock.json
            ./backend/tsconfig.json
            ./backend/tsconfig.build.json
            ./backend/README.md
          ];

          backendApp = pkgs.buildNodeApplication {
            pname = "mokosh-api";
            version = "0.1.0";

            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                ./backend/package.json
                ./backend/package-lock.json
                ./backend/tsconfig.json
                ./backend/tsconfig.build.json
                ./backend/src
                ./backend/drizzle
              ];
            };

            # `npm run build` is `tsc -p tsconfig.build.json`, which emits
            # dist/ next to the sources.
            npmBuildScript = "build";

            # npm ci needs a writable HOME and npm's cache, and refuses to run
            # as root without --unsafe-perm.
            npmInstallFlags = [
              "--include=dev"
              "--no-audit"
              "--no-fund"
            ];

            # Runtime env is read from a real file, so `nix run` must not
            # inherit a developer's local backend/.env by accident.
            makeWrapperArgs = [
              "--set-default DATABASE_URL ''"
            ];

            doCheck = true;

            meta = {
              description = "Mokosh API — Fastify + Drizzle backend";
              mainProgram = "mokosh-api";
            };
          };
        in
        {
          treefmt = treefmtSettings;

          devShells.default = pkgs.mkShell {
            name = "mokosh-dev";

            packages =
              with pkgs;
              [
                nodejs_22
                pnpm
                prettier
                watchexec
                jq
                yq
                ripgrep
                just
                # Used by scripts/db.sh when docker is unavailable.
                postgresql
                statix
                deadnix
              ]
              ++ lib.optionals isLinux [
                docker
                docker-compose
                # Full Android SDK (platform 35 + build-tools 35.0.0, no NDK —
                # everything native ships prebuilt). adb/fastboot come along
                # via platform-tools; JAVA_HOME points at nixpkgs JDK 17.
                android.sdk
                pkgsAndroid.jdk17
                android-tools
              ];

            shellHook =
              ''
                export PANICMAP_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
                export PATH="$PANICMAP_ROOT/scripts:$PATH"
              ''
              + lib.optionalString isLinux ''
                if [ -d "$HOME/Android/sdk" ]; then
                  export ANDROID_HOME="$HOME/Android/sdk"
                  export ANDROID_SDK_ROOT="$HOME/Android/sdk"
                else
                  export ANDROID_HOME="${android.env.ANDROID_HOME}"
                  export ANDROID_SDK_ROOT="${android.env.ANDROID_SDK_ROOT}"
                fi
                export JAVA_HOME="${android.env.JAVA_HOME}"
                export PATH="$ANDROID_HOME/platform-tools:$PATH"
              ''
              + ''
              echo ""
              echo "  Mokosh devshell — $(uname -s) $(uname -m)"
              echo "    just setup   install app + backend dependencies"
              echo "    just api     Fastify REST on :8000 (docs at /docs)"
              echo "    just worker  alert escalation worker"
              echo "    just app     Expo dev server (needs a development build)"
              echo "    just db:up   postgres via docker, else the nix postgres above"
              echo "    just check   typecheck, vitest, format check"
              echo ""
            '';
          };

          # A runnable backend closure. There is deliberately no Docker image
          # output: a nix store path cannot be meaningfully flattened into a
          # container layer, so the image is built by infra/Dockerfile instead,
          # which resolves dependencies with npm and needs no nix at all.
          packages = {
            inherit backendApp;
            default = backendApp;
            api = backendApp;
          };

          apps.default = {
            type = "app";
            program = "${backendApp}/bin/mokosh-api";
          };

          checks = {
            backend-typecheck =
              pkgs.runCommand "backend-typecheck"
                { nativeBuildInputs = [ pkgs.nodejs_22 backendToolchain ]; }
                ''
                  export HOME="$TMPDIR"
                  cd ${backendToolchain}
                  npx tsc --noEmit
                  touch $out
                '';

            # The suite runs on PGlite, an in-process Postgres, so this needs
            # nothing from the host — no initdb, no port, no socket.
            backend-vitest =
              pkgs.runCommand "backend-vitest"
                { nativeBuildInputs = [ pkgs.nodejs_22 backendToolchain ]; }
                ''
                  export HOME="$TMPDIR"
                  cd ${backendToolchain}
                  npx vitest run
                  touch $out
                '';

            prettier =
              pkgs.runCommand "prettier"
                {
                  nativeBuildInputs = [
                    pkgs.nodejs_22
                    pkgs.prettier
                  ];
                }
                ''
                  cd ${./app}
                  export HOME="$TMPDIR"
                  prettier --check "src/**/*.{ts,tsx}"
                  touch $out
                '';

            shellcheck =
              pkgs.runCommand "shellcheck"
                {
                  nativeBuildInputs = [ pkgs.shellcheck pkgs.shfmt ];
                }
                ''
                  cd ${self}
                  export HOME="$TMPDIR"
                  shfmt -d -i 2 scripts/*.sh
                  shellcheck -x scripts/*.sh
                  touch $out
                '';

            nix-format =
              pkgs.runCommand "nix-format"
                {
                  nativeBuildInputs = [ pkgs.alejandra ];
                }
                ''
                  cd ${self}
                  find . -name '*.nix' -not -path './.direnv/*' -print0 \
                    | xargs -0 -r alejandra --check
                  touch $out
                '';
          };
        };
    };
}