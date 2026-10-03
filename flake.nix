{
  description = "Safe Call — alarm, który wygląda jak mapa";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/c59305bab2065cfecc4944690d9eedbb56f3a9fa";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix/27b3b12a8e6375f28ebe122f07d230ca5459bbfa";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      treefmt-nix,
      ...
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      pkgsFor = nixpkgs.lib.genAttrs supportedSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          inherit pkgs;

          treefmtConfig = treefmt-nix.lib.mkWrapper pkgs {
            projectRootFile = "flake.nix";

            programs.deadnix.enable = true;
            programs.statix.enable = true;
            programs.nixfmt.enable = true;
            programs.shellcheck.enable = true;
            programs.shfmt.enable = true;

            programs.prettier = {
              enable = true;
              settings = {
                printWidth = 80;
                semi = false;
                singleQuote = false;
                trailingComma = "es5";
                tabWidth = 2;
              };
            };

            settings.excludes = [
              "node_modules"
              ".expo"
              "dist"
              "build"
              "result"
              "result-*"
              "pnpm-lock.yaml"
              "apps/mobile/assets"
            ];
          };
        }
      );

      forEachSystem = nixpkgs.lib.genAttrs supportedSystems;

      shellHook = ''
        echo "Safe Call — środowisko gotowe"
        echo "  pnpm install                                 # zależności"
        echo "  pnpm db:up                                   # postgres (docker)"
        echo "  pnpm --filter @safecall/server db:migrate"
        echo "  pnpm dev                                     # serwer :4000"
        echo "  pnpm --filter @safecall/mobile start         # expo (android)"
        echo "  nix fmt                                      # format"
      '';

      # Node, Postgres and the Android tools are the whole runtime story; the
      # mobile app is driven through Expo Go, so nothing native is cross-built.
      devPackages =
        pkgs: with pkgs; [
          nodejs_24
          pnpm
          typescript

          docker
          docker-compose

          postgresql_17
          libpq

          jdk17
          android-tools

          git
          curl
          jq
          ripgrep
          fd
          yq-go
          openssl
          netcat
          tree

          gcc
          clang
          gnumake
          pkg-config
        ];
    in
    {
      nixConfig = {
        flake = true;
      };

      devShells = forEachSystem (
        system:
        let
          inherit (pkgsFor.${system}) pkgs;
        in
        {
          default = pkgs.mkShell {
            name = "safe-call";

            packages = devPackages pkgs;

            shellHook = shellHook + ''
              export ANDROID_HOME=${pkgs.android-tools}/libexec/android-sdk
              export PATH="$PATH:$ANDROID_HOME/platform-tools"
            '';
          };
        }
      );

      packages = forEachSystem (
        system:
        let
          inherit (pkgsFor.${system}) pkgs treefmtConfig;
        in
        {
          default = treefmtConfig;

          safe-call = pkgs.stdenv.mkDerivation {
            pname = "safe-call";
            version = "0.1.0";

            src = pkgs.lib.cleanSource ./.;

            dontConfigure = true;
            dontBuild = true;

            installPhase = ''
              runHook preInstall
              mkdir -p "$out/share/doc/safe-call"
              cp README.md flake.nix docker-compose.yml "$out/share/doc/safe-call/"
              cp apps/server/src/db/migrations/0000_init.sql "$out/share/doc/safe-call/"
              runHook postInstall
            '';

            meta = {
              description = "Safe Call — alarm, który wygląda jak mapa";
              platforms = pkgs.lib.platforms.all;
            };
          };
        }
      );

      apps = forEachSystem (
        system:
        let
          inherit (pkgsFor.${system}) pkgs;
          inherit (pkgsFor.${system}) treefmtConfig;
        in
        {
          default = {
            type = "app";
            program = "${pkgs.nodejs_24}/bin/node";
            meta.description = "node --version";
          };

          fmt = {
            type = "app";
            program = "${treefmtConfig}/bin/treefmt";
            meta.description = "Sformatuj repozytorium";
          };
        }
      );

      checks = forEachSystem (system: {
        formatting = pkgsFor.${system}.treefmtConfig;
      });

      formatter = forEachSystem (system: pkgsFor.${system}.treefmtConfig);
    };
}
