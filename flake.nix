{
  description = "Passless FIDO2 authenticator with declarative Linux integration";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      packages = forAllSystems (system: let pkgs = import nixpkgs { inherit system; }; in {
        default = pkgs.callPackage ./nix/package.nix { };
        passless = self.packages.${system}.default;
      });
      checks = forAllSystems (system: let pkgs = import nixpkgs { inherit system; }; in {
        inherit (self.packages.${system}) passless;
        usbIdentity = pkgs.runCommand "passless-usb-identity-checks" {
          nativeBuildInputs = [ pkgs.rustc pkgs.stdenv.cc ];
        } ''
          rustc --edition 2024 --test ${./cmd/passless/src/usb_identity.rs} -o identity-tests
          ./identity-tests
          rustc --edition 2024 --test ${./cmd/passless/src/hid_capabilities.rs} -o capability-tests
          ./capability-tests
          touch $out
        '';
      });
      overlays.default = final: prev: { passless = final.callPackage ./nix/package.nix { }; };
      nixosModules.default = import ./nix/nixos.nix;
      homeManagerModules.default = import ./nix/home-manager.nix;
    };
}
