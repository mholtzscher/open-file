{
  bun2nix,
  pkgs,
  stdenv,
}:
bun2nix.mkDerivation {
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
}
