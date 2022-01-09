class CDUAvailableDeparturesPage {
    static ShowPage(mcdu, airport, pageCurrent = 0, sidSelection = false) {
        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.AvailableDeparturesPage;
        let selectedRunwayCell = "---";
        let selectedRunwayCellColor = "white";

        // TODO ALTN, SEC
        const concernedPlan = mcdu.flightPlanService.activeOrTemporary;
        const isTemporary = mcdu.flightPlanService.hasTemporary;

        const selectedRunway = concernedPlan.originRunway;

        if (selectedRunway) {
            selectedRunwayCell = Avionics.Utils.formatRunway(selectedRunway.ident);
            selectedRunwayCellColor = isTemporary ? "yellow" : "green";
        }

        let selectedSidCell = "------";
        let selectedSidCellColor = "white";
        let selectedTransCell = "------";
        let selectedTransCellColor = "white";

        const selectedDeparture = concernedPlan.originDeparture;
        if (selectedDeparture) {
            selectedSidCell = selectedDeparture.ident;
            selectedSidCellColor = isTemporary ? "yellow" : "green";
            const departureEnRouteTransition = concernedPlan.departureEnrouteTransition;

            if (departureEnRouteTransition) {
                selectedTransCell = departureEnRouteTransition.ident;
                selectedTransCellColor = isTemporary ? "yellow" : "green";
            } else {
                selectedTransCell = "NONE";
            }
        }

        let doInsertRunwayOnly = false;
        let insertRow = ["<RETURN"];
        mcdu.onLeftInput[5] = () => {
            CDUFlightPlanPage.ShowPage(mcdu);
        };

        const runways = concernedPlan.availableOriginRunways;

        const rows = [[""], [""], [""], [""], [""], [""], [""], [""]];
        if (!sidSelection) {
            for (let i = 0; i < 4; i++) {
                const index = i + pageCurrent;
                const runway = runways[index];
                if (runway) {
                    rows[2 * i] = [
                        "{" + runway.ident + "[color]cyan",
                        "",
                        runway.length.toFixed(0) + "{small}M{end}[color]cyan"
                    ];
                    rows[2 * i + 1] = ["{sp}{sp}{sp}{sp}" + Utils.leadingZeros(Math.round((runway.bearing)), 3) + "[color]cyan",];

                    mcdu.onLeftInput[i + 1] = async () => {
                        await mcdu.flightPlanService.setOriginRunway(runway.ident);

                        CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, true);
                    };
                }
            }
        } else {
            doInsertRunwayOnly = true;
            insertRow = ["{ERASE[color]amber", "INSERT*[color]amber"];
            mcdu.onRightInput[5] = () => {
                mcdu.flightPlanService.temporaryInsert();

                mcdu.updateConstraints();
                mcdu.onToRwyChanged();
                CDUPerformancePage.UpdateThrRedAccFromOrigin(mcdu, true, true);
                CDUPerformancePage.UpdateEngOutAccFromOrigin(mcdu);
                CDUFlightPlanPage.ShowPage(mcdu, 0);
            };
            let rowIndex = -pageCurrent + 1;
            let index = 0;
            rows[0] = ["{NONE[color]cyan"];

            mcdu.onLeftInput[rowIndex + 1] = async () => {
                await mcdu.flightPlanService.setDepartureProcedure(undefined);

                CDUAvailableDeparturesPage.ShowPage(mcdu, airport);
            };

            while (rowIndex < 4 && index < concernedPlan.availableDepartures.length) {
                const sid = concernedPlan.availableDepartures[index];

                let transitionIndex = 0;
                index++;
                if (sid) {
                    let sidMatchesSelectedRunway = false;
                    if (!selectedRunway) {
                        sidMatchesSelectedRunway = true;
                    } else {
                        for (let j = 0; j < sid.runwayTransitions.length; j++) {
                            if (sid.runwayTransitions[j].ident.indexOf(selectedRunway.ident) !== -1) {
                                sidMatchesSelectedRunway = true;
                                transitionIndex = j;
                                break;
                            }
                        }
                    }
                    if (sidMatchesSelectedRunway) {
                        if (rowIndex >= 1) {
                            rows[2 * rowIndex] = ["{" + sid.ident + "[color]cyan"];

                            mcdu.onLeftInput[rowIndex + 1] = async () => {
                                await mcdu.flightPlanService.setDepartureProcedure(sid.ident).catch(console.error);

                                CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, true);
                            };
                        }
                        rowIndex++;
                    }
                }
            }
            if (selectedDeparture) {
                for (let i = 0; i < 4; i++) {
                    const enRouteTransitionIndex = i + pageCurrent;
                    const enRouteTransition = selectedDeparture.enrouteTransitions[enRouteTransitionIndex];

                    if (enRouteTransition) {
                        rows[2 * i][1] = enRouteTransition.ident + "}[color]cyan";

                        mcdu.onRightInput[i + 1] = async () => {
                            await mcdu.flightPlanService.setDepartureEnrouteTransition(enRouteTransition.ident).catch(console.error);

                            CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, true);
                        };
                    }
                }
            }
        }
        let up = false;
        let down = false;
        let maxPage = 0;
        if (sidSelection) {
            if (selectedRunway) {
                for (const departure of concernedPlan.availableDepartures) {
                    for (const transition of departure.runwayTransitions) {
                        if (transition.ident === selectedRunway.ident) {
                            maxPage++;
                            break;
                        }
                    }
                }
                maxPage -= 3;
            } else {
                maxPage = concernedPlan.availableDepartures.length - 3;
            }
            if (selectedDeparture) {
                maxPage = Math.max(maxPage, selectedDeparture.enrouteTransitions.length - 4);
            }
        } else {
            maxPage = runways.length - 4;
        }
        if (pageCurrent < maxPage) {
            mcdu.onUp = () => {
                pageCurrent++;
                if (pageCurrent < 0) {
                    pageCurrent = 0;
                }
                CDUAvailableDeparturesPage.ShowPage(mcdu, airport, pageCurrent, sidSelection);
            };
            up = true;
        }
        if (pageCurrent > 0) {
            mcdu.onDown = () => {
                pageCurrent--;
                if (pageCurrent < 0) {
                    pageCurrent = 0;
                }
                CDUAvailableDeparturesPage.ShowPage(mcdu, airport, pageCurrent, sidSelection);
            };
            down = true;
        }
        mcdu.setArrows(up, down, true, true);
        mcdu.setTemplate([
            ["DEPARTURES {small}FROM{end} {green}" + airport.ident + "{end}"],
            ["{sp}RWY", "TRANS{sp}", "{sp}SID"],
            [selectedRunwayCell + "[color]" + selectedRunwayCellColor, selectedTransCell + "[color]" + selectedTransCellColor, selectedSidCell + "[color]" + selectedSidCellColor],
            sidSelection ? ["SIDS", "TRANS", "AVAILABLE"] : ["", "", "RUNWAYS AVAILABLE"],
            rows[0],
            rows[1],
            rows[2],
            rows[3],
            rows[4],
            rows[5],
            rows[6],
            rows[7],
            insertRow
        ]);
        mcdu.onPrevPage = () => {
            CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, !sidSelection);
        };
        mcdu.onNextPage = mcdu.onPrevPage;
    }
}
