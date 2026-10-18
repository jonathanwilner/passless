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
      checks = forAllSystems (system: { inherit (self.packages.${system}) passless; });
      overlays.default = final: prev: { passless = final.callPackage ./nix/package.nix { }; };
      nixosModules.default = import ./nix/nixos.nix;
      homeManagerModules.default = import ./nix/home-manager.nix;
    };
}
