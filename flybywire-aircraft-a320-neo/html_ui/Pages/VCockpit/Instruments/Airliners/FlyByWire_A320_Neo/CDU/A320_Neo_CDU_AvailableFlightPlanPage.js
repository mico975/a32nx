class CDUAvailableFlightPlanPage {
    static ShowPage(mcdu) {
        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.AvailableFlightPlanPage;
        let fromTo = "NO ORIGIN/DEST";

        const origin = mcdu.flightPlanService.active.originAirport;
        const dest = mcdu.flightPlanService.active.destinationAirport;

        if (origin && dest) {
            fromTo = `${origin.ident}/${dest.ident}`;
        }

        mcdu.setTemplate([
            [fromTo],
            [""],
            ["NONE[color]green"],
            [""],
            [""],
            [""],
            [""],
            [""],
            [""],
            [""],
            [""],
            [""],
            ["<RETURN"]
        ]);
        mcdu.onLeftInput[5] = () => {
            CDUInitPage.ShowPage1(mcdu);
        };
    }
}
