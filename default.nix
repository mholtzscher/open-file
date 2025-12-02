{ bun2nix, stdenv, ... }:
bun2nix.writeBunApplication {
  pname = "open-file";
  version = "1.0.0";
  src = ./.;

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };

  # Use hoisted linker for better peer dependency resolution
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

  # Skip bun build phase - this app runs directly via bun run
  dontUseBunBuild = true;
  dontUseBunCheck = true;

  startScript = ''
    bun run src/index.tsx "$@"
  '';
}
