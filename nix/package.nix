{ lib, rustPlatform, pkg-config, systemd, makeWrapper, installShellFiles, gnupg, git, openssh }:
rustPlatform.buildRustPackage {
  pname = "passless";
  version = "0.20.2";
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../Cargo.toml ../Cargo.lock ../LICENSE ../README.md
      ../cmd ../passless-core ../passless-config-doc ../passless-uhid ../tools
    ];
  };
  cargoLock.lockFile = ../Cargo.lock;
  nativeBuildInputs = [ pkg-config makeWrapper installShellFiles ];
  buildInputs = [ systemd ];
  cargoBuildFlags = [ "-p" "passless-rs" ];
  # Unit tests only. Hardware and user-interaction tests require a separate live session.
  cargoTestFlags = [ "-p" "passless-core" "-p" "passless-config-doc" ];
  postInstall = ''
    wrapProgram $out/bin/passless --prefix PATH : ${lib.makeBinPath [ gnupg git openssh ]}
    wrapProgram $out/bin/passless-git-sync --prefix PATH : ${lib.makeBinPath [ gnupg git openssh ]}
    completions=$(find target -path '*/out/completions/passless.bash' -print -quit)
    if [ -n "$completions" ]; then
      installShellCompletion --bash "$completions" \
        --zsh "$(dirname "$completions")/_passless" \
        --fish "$(dirname "$completions")/passless.fish"
    fi
  '';
  meta = {
    description = "Software FIDO2 authenticator backed by encrypted password-store";
    homepage = "https://github.com/pando85/passless";
    license = lib.licenses.gpl3Only;
    platforms = lib.platforms.linux;
    mainProgram = "passless";
  };
}
