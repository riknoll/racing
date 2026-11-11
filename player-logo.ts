namespace racing {
    const LOGO_SIZE = 40;
    const teamLogos: Image[] = [];

    export function setTeamLogoImage(logo: Image, target: CarTarget): void {
        const drawing = image.create(LOGO_SIZE, LOGO_SIZE);
        drawing.drawTransparentImage(logo, Math.floor((LOGO_SIZE - logo.width) / 2),
            Math.floor((LOGO_SIZE - logo.height) / 2));
        teamLogos[target] = drawing;
    }

    export function createTeamLogo(car: Car, targetTeam: CarTarget = CarTarget.Player): scene.Renderable {
        const left = Math.round(car.x - LOGO_SIZE / 2);
        const top = Math.round(car.y - LOGO_SIZE / 2);
        return scene.createRenderable(car.z - 1, (target, camera) => {
            const logo = teamLogos[targetTeam];
            if (logo) target.drawTransparentImage(logo, left - camera.drawOffsetX, top - camera.drawOffsetY);
        });
    }
}
