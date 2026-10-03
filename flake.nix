{
  description = "PanicMap — a map that looks like a map. HackYeah 2026.";

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
          android = import ./nix/android-sdk.nix { pkgs = pkgsAndroid; inherit system; };
          # `nix fmt` runs treefmt, which drives prettier, ruff, alejandra,
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
              "*.egg-info"
              "*.png"
              "*.wav"
              "*.m4a"
              "*.mp3"
              "package-lock.json"
              "uv.lock"
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

          # treefmt-nix exposes ruff as two modules; the `**/` prefix is
          # needed because every Python file lives under backend/.
          programs."ruff-format" = {
            enable = true;
            includes = [ "**/*.py" ];
            lineLength = 100;
          };
          programs."ruff-check" = {
            enable = true;
            includes = [ "**/*.py" ];
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

          backendFiles = lib.fileset.unions [
            ./backend/pyproject.toml
            ./backend/uv.lock
            ./backend/README.md
          ];

          # Dependencies are vendored with uv straight from the lockfile. No
          # uv2nix: it would add a second lockfile to keep in sync, which is a
          # bad trade with 36 hours left.
          backendDeps = pkgs.python313.pkgs.buildPythonApplication {
            pname = "panicmap-api-deps";
            version = "0.1.0";
            # Not a wheel: this just materialises the locked dependency set
            # into a site-packages directory.
            format = "other";

            src = lib.fileset.toSource { root = ./.; fileset = backendFiles; };

            nativeBuildInputs = [
              pkgs.uv
              pkgs.python313.pkgs.setuptools
            ];

            buildPhase = ''
              runHook preBuild
              export UV_CACHE_DIR="$TMPDIR/uv-cache"
              export UV_NO_MODERATION=1
              export UV_PYTHON_DOWNLOADS=never
              # The fileset is rooted at the repo, so the project lives in
              # backend/ inside the source tree.
              cd backend
              uv export --frozen --no-emit-project --no-hashes \
                --python ${pkgs.python313}/bin/python3 \
                --format requirements.txt --output-file requirements.txt
              touch requirements.txt
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              export UV_CACHE_DIR="$TMPDIR/uv-cache"
              export UV_NO_MODERATION=1
              export UV_PYTHON_DOWNLOADS=never
              local site="$out/lib/python3.13/site-packages"
              mkdir -p "$site"
              uv pip install \
                --python ${pkgs.python313}/bin/python3 \
                --target "$site" \
                --no-compile \
                --no-cache \
                -r requirements.txt
              runHook postInstall
            '';

            doCheck = false;
            pythonRelaxedDepRequires = true;
            # The build reaches PyPI and npm-less uv has no substitute.
            allowSubstitutes = false;
            preferLocalBuild = true;
          };

          backendApp = pkgs.python313.pkgs.buildPythonApplication {
            pname = "panicmap-api";
            version = "0.1.0";
            # Not a wheel either: buildPhase and installPhase are overridden
            # below to use the uv virtualenv produced by `uv sync`.
            format = "other";

            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                ./backend/pyproject.toml
                ./backend/uv.lock
                ./backend/README.md
                ./backend/src
              ];
            };

            nativeBuildInputs = [
              pkgs.uv
              pkgs.python313.pkgs.setuptools
            ];

            # `backendDeps` is deliberately *not* propagated here: `uv sync`
            # already produces a self-contained virtualenv, and listing both
            # would put two copies of every dependency in the closure.

            buildPhase = ''
              runHook preBuild
              export UV_CACHE_DIR="$TMPDIR/uv-cache"
              export UV_NO_MODERATION=1
              export UV_PYTHON_DOWNLOADS=never
              cd backend
              uv sync --frozen --no-dev --no-editable
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              local site="$out/lib/python3.13/site-packages"
              mkdir -p "$site"
              cp -r .venv/lib/python3.13/site-packages/. "$site/"

              mkdir -p "$out/bin"
              cat > "$out/bin/hy-api" <<EOF
              #!${pkgs.python313}/bin/python3
              import sys
              sys.path.insert(0, "$site")
              from hy.asgi import main
              raise SystemExit(main())
              EOF
              chmod +x "$out/bin/hy-api"
              runHook postInstall
            '';

            doCheck = false;
            pythonRelaxedDepRequires = true;
            allowSubstitutes = false;
            preferLocalBuild = true;

            meta = {
              description = "PanicMap API — FastAPI + WebSocket backend";
              mainProgram = "hy-api";
            };
          };
        in
        {
          treefmt = treefmtSettings;

          devShells.default = pkgs.mkShell {
            name = "panicmap-dev";

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
                uv
                python313
                python313Packages.pip
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
                export ANDROID_HOME="${android.env.ANDROID_HOME}"
                export ANDROID_SDK_ROOT="${android.env.ANDROID_SDK_ROOT}"
                export JAVA_HOME="${android.env.JAVA_HOME}"
                export PATH="$ANDROID_HOME/platform-tools:$PATH"
              '';
              echo ""
              echo "  PanicMap devshell — $(uname -s) $(uname -m)"
              echo "    just setup   install app + backend dependencies"
              echo "    just api     FastAPI (REST + /ws/locations) on :8000"
              echo "    just app     Expo dev server (needs a development build)"
              echo "    just db:up   postgres via docker, else the nix postgres above"
              echo "    just check   lint, typecheck, pytest, format check"
              echo ""
            '';
          };

          # A runnable backend closure. There is deliberately no Docker image
          # output: a nix store path cannot be meaningfully flattened into a
          # container layer, so the image is built by infra/Dockerfile instead,
          # which resolves dependencies with uv and needs no nix at all.
          packages = {
            inherit backendApp;
            default = backendApp;
            api = backendApp;
          };

          apps.default = {
            type = "app";
            program = "${backendApp}/bin/hy-api";
          };

          checks = {
            backend-lint =
              pkgs.runCommand "backend-lint"
                {
                  nativeBuildInputs = [
                    pkgs.python313
                    backendDeps
                    pkgs.ruff
                  ];
                }
                ''
                  cd ${./backend}
                  ruff check src tests
                  touch $out
                '';

            backend-format =
              pkgs.runCommand "backend-format"
                {
                  nativeBuildInputs = [
                    pkgs.python313
                    backendDeps
                    pkgs.ruff
                  ];
                }
                ''
                  cd ${./backend}
                  ruff format --check src tests
                  touch $out
                '';

            # Runs the suite against a Postgres started inside the build, so
            # `nix flake check` needs nothing from the host.
            backend-pytest =
              pkgs.runCommand "backend-pytest"
                {
                  nativeBuildInputs = [
                    pkgs.python313
                    backendDeps
                    pkgs.python313Packages.pytest
                    pkgs.postgresql
                  ];
                  PGPORT = "5440";
                }
                ''
                  export HOME="$TMPDIR"
                  export PGDATA="$TMPDIR/pgdata"
                  export PGSOCK="$TMPDIR/pgsock"
                  mkdir -p "$PGSOCK"

                  initdb -D "$PGDATA" -U panicmap --auth=trust >/dev/null
                  pg_ctl -D "$PGDATA" \
                    -o "-p $PGPORT -k $PGSOCK -c listen_addresses=127.0.0.1" \
                    -w start >/dev/null
                  trap 'pg_ctl -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true' EXIT

                  createdb -h "$PGSOCK" -p "$PGPORT" -U panicmap panicmap_test

                  cd ${./backend}
                  export PYTHONPATH="$PWD/src"
                  export TEST_DATABASE_URL="postgresql+psycopg://panicmap@127.0.0.1:$PGPORT/panicmap_test"
                  pytest -q tests
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