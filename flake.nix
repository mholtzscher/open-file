{
  description = "Terminal UI for S3 bucket exploration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    systems.url = "github:nix-systems/default";
    bun2nix = {
      url = "github:nix-community/bun2nix?tag=2.0.6";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.systems.follows = "systems";
    };
  };

  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org"
      "https://nix-community.cachix.org"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };

  outputs =
    inputs:
    let
      eachSystem = inputs.nixpkgs.lib.genAttrs (import inputs.systems);

      pkgsFor = eachSystem (
        system:
        import inputs.nixpkgs {
          inherit system;
          overlays = [ inputs.bun2nix.overlays.default ];
        }
      );
    in
    {
      packages = eachSystem (
        system:
        let
          pkgs = pkgsFor.${system};
        in
        {
          default = pkgs.bun2nix.mkDerivation rec {
            inherit (pkgs) stdenv;
            pname = "open-file";
            version = "1.0.0";

            src = ./.;

            bunDeps = pkgs.bun2nix.fetchBunDeps {
              bunNix = ./bun.nix;
            };

            bunInstallFlags =
              if stdenv.hostPlatform.isDarwin then
                [
                  "--linker=hoisted"
                  "--backend=copyfile"
                ]
              else
                [
                  "--linker=hoisted"
                ];

            nativeBuildInputs = with pkgs; [
              makeWrapper
              bun
            ];

            env.OPEN_FILE_VERSION = "1.0.0";

            buildPhase = ''
              runHook preBuild
              bun run ./bundle.ts
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/open-file $out/bin

              cp -r dist node_modules $out/lib/open-file

              makeWrapper ${pkgs.bun}/bin/bun $out/bin/open-file \
                --add-flags "run" \
                --add-flags "$out/lib/open-file/dist/index.js" \
                --argv0 open-file

              runHook postInstall
            '';

            meta = {
              description = "Terminal UI for S3 bucket exploration";
              mainProgram = "open-file";
            };
          };
        }
      );

      devShells = eachSystem (system: {
        default = pkgsFor.${system}.mkShell {
          packages = with pkgsFor.${system}; [
            bun
            bun2nix
          ];

          shellHook = ''
            bun install --frozen-lockfile
          '';
        };
      });
    };
}
