/*
 * A32NX
 * Copyright (C) 2020-2021 FlyByWire Simulations and its contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * translates MSFS navdata approach type to honeywell ordering
 */
const ApproachTypeOrder = Object.freeze([
    // MLS
    ApproachType.APPROACH_TYPE_ILS,
    // GLS
    // IGS
    ApproachType.APPROACH_TYPE_LOCALIZER,
    ApproachType.APPROACH_TYPE_LOCALIZER_BACK_COURSE,
    ApproachType.APPROACH_TYPE_LDA,
    ApproachType.APPROACH_TYPE_SDF,
    ApproachType.APPROACH_TYPE_GPS,
    ApproachType.APPROACH_TYPE_RNAV,
    ApproachType.APPROACH_TYPE_VORDME,
    ApproachType.APPROACH_TYPE_VOR,
    ApproachType.APPROACH_TYPE_NDBDME,
    ApproachType.APPROACH_TYPE_NDB,
    ApproachType.APPROACH_TYPE_UNKNOWN, // should be "runway by itself"...
]);

class CDUAvailableArrivalsPage {
    static ShowPage(mcdu, airport, pageCurrent = 0, starSelection = false, index = Fmgc.FlightPlanIndex.Active) {
        const isTemporary = index === Fmgc.FlightPlanIndex.Active && mcdu.flightPlanService.hasTemporary;
        const planIndex = isTemporary ? Fmgc.FlightPlanIndex.Temporary : index;

        let planColor;
        if (planIndex === Fmgc.FlightPlanIndex.Active) {
            planColor = 'green';
        } else if (planIndex === Fmgc.FlightPlanIndex.Temporary) {
            planColor = 'yellow';
        } else if (planIndex >= Fmgc.FlightPlanIndex.FirstSecondary) {
            planColor = 'white';
        }

        let selectedStarIdent = undefined;
        if (mcdu.flightPlanService.activeOrTemporary.arrival) {
            selectedStarIdent = mcdu.flightPlanService.activeOrTemporary.arrival.ident;
        }

        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.AvailableArrivalsPage;

        const selectedApproach = mcdu.flightPlanService.activeOrTemporary.approach;

        let selectedApproachCell = "------";
        let selectedViasCell = "------";
        if (selectedApproach && selectedApproach.ident) {
            selectedApproachCell = Avionics.Utils.formatRunway(selectedApproach.ident);

            const selectedApproachVia = mcdu.flightPlanService.activeOrTemporary.approachVia;

            if (selectedApproachVia) {
                selectedViasCell = selectedApproachVia.ident;
            } else {
                selectedViasCell = "NONE";
            }
        }

        const selectedArrival = mcdu.flightPlanService.activeOrTemporary.arrival;

        let selectedStarCell = "------";
        let selectedTransitionCell = "------";
        if (selectedArrival) {
            selectedStarCell = selectedArrival.ident;

            const selectedTransition = mcdu.flightPlanService.activeOrTemporary.arrivalEnrouteTransition;

            if (selectedTransition) {
                selectedTransitionCell = selectedTransition.ident;
            }
        }

        const approaches = mcdu.flightPlanService.activeOrTemporary.availableApproaches;

        // Add an index member variable so we can track the original order of approaches
        for (let j = 0; j < approaches.length; j++) {
            approaches[j].index = j;
        }

        // Sort the approaches in Honeywell's documented order
        const sortedApproaches = approaches.slice().sort((a, b) => ApproachTypeOrder.indexOf(a.approachType) - ApproachTypeOrder.indexOf(b.approachType));
        const rows = [[""], [""], [""], [""], [""], [""], [""], [""]];

        const matchingArrivals = mcdu.flightPlanService.activeOrTemporary.availableArrivals;

        if (!starSelection) {
            for (let i = 0; i < 3; i++) {
                const index = i + pageCurrent;
                const approach = sortedApproaches[index];

                if (approach) {
                    const runwayLength = 0;
                    const runwayCourse = 0;

                    rows[2 * i] = ["{" + Avionics.Utils.formatRunway(approach.ident.replace(/\s+/g, '')) + "[color]cyan", "", "{sp}{sp}{sp}{sp}" + runwayLength + "{small}M{end}[color]cyan"];
                    rows[2 * i + 1] = ["{sp}{sp}{sp}{sp}" + runwayCourse + "[color]cyan"];

                    mcdu.onLeftInput[i + 2] = async () => {
                        const approachRunway = mcdu.flightPlanService.activeOrTemporary.availableDestinationRunways.find((runway) => (
                            approach.ident.includes(runway.ident.substring(2))
                        ));

                        await mcdu.flightPlanService.setDestinationRunway(approachRunway.ident);
                        await mcdu.flightPlanService.activeOrTemporary.setApproach(approach.ident).catch(console.error);

                        CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                    };
                }
            }
        } else {
            for (let i = 0; i < 3; i++) {
                let index = i + pageCurrent;
                if (index === 0) {
                    let color = "cyan";
                    if (!selectedArrival) {
                        color = "green";
                    }

                    rows[2 * i] = ["{NO STAR[color]" + color];

                    mcdu.onLeftInput[i + 2] = async () => {
                        await mcdu.flightPlanService.setArrival(undefined).catch(console.error);

                        CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                    };
                } else {
                    index--;
                    if (matchingArrivals[index]) {
                        const star = matchingArrivals[index];

                        let color = "cyan";
                        if (selectedStarIdent === matchingArrivals[index].ident) {
                            color = "green";
                        }

                        rows[2 * i] = ["{" + star.ident + "[color]" + color];

                        mcdu.onLeftInput[i + 2] = async () => {
                            await mcdu.flightPlanService.activeOrTemporary.setArrival(star.ident).catch(console.error);

                            if (mcdu.flightPlanService.activeOrTemporary.approach) {
                                CDUAvailableArrivalsPage.ShowViasPage(mcdu, airport);
                            } else {
                                CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                            }
                        };
                    }
                }
            }

            rows[0][1] = "NONE}[color]cyan";

            mcdu.onRightInput[2] = async () => {
                await mcdu.flightPlanService.setArrival(selectedStarIdent).catch(console.error);
                mcdu.flightPlanService.setArrivalEnrouteTransition(undefined);

                CDUAvailableArrivalsPage.ShowPage(mcdu, airport);
            };

            for (let i = 0; i < 2; i++) {
                const index = i + pageCurrent;
                if (selectedArrival) {
                    const transition = selectedArrival.enrouteTransitions[index];
                    if (transition) {
                        const ident = transition.ident;

                        rows[2 * (i + 1)][1] = ident + "}[color]cyan";

                        mcdu.onRightInput[i + 3] = async () => {
                            mcdu.flightPlanService.setArrivalEnrouteTransition(ident);

                            CDUAvailableArrivalsPage.ShowPage(mcdu, airport);
                        };
                    }
                }
            }
        }

        let viasPageLabel = "";
        let viasPageLine = "";
        if (starSelection) {
            if (selectedApproach) {
                viasPageLabel = "{sp}APPR";
                viasPageLine = "<VIAS";
                mcdu.onLeftInput[1] = () => {
                    CDUAvailableArrivalsPage.ShowViasPage(mcdu, airport, 0);
                };
            }
        }
        let bottomLine = ["<RETURN"];

        if (isTemporary) {
            bottomLine = ["{ERASE[color]amber", "INSERT*[color]amber"];

            mcdu.onLeftInput[5] = async () => {
                mcdu.flightPlanService.temporaryDelete();

                CDUFlightPlanPage.ShowPage(mcdu);
            };

            mcdu.onRightInput[5] = async () => {
                mcdu.flightPlanService.temporaryInsert();

                mcdu.updateTowerHeadwind();
                mcdu.updateConstraints();
                CDUPerformancePage.UpdateThrRedAccFromDestination(mcdu);

                CDUFlightPlanPage.ShowPage(mcdu);
            };
        } else {
            mcdu.onLeftInput[5] = () => {
                CDUFlightPlanPage.ShowPage(mcdu);
            };
        }
        let up = false;
        let down = false;
        const maxPage = starSelection ? (selectedArrival ? Math.max(selectedArrival.enrouteTransitions.length - 2, matchingArrivals.length - 2) : matchingArrivals.length - 2) : (pageCurrent, approaches.length - 3);
        if (pageCurrent < maxPage) {
            mcdu.onUp = () => {
                pageCurrent++;
                if (pageCurrent < 0) {
                    pageCurrent = 0;
                }
                CDUAvailableArrivalsPage.ShowPage(mcdu, airport, pageCurrent, starSelection);
            };
            up = true;
        }
        if (pageCurrent > 0) {
            mcdu.onDown = () => {
                pageCurrent--;
                if (pageCurrent < 0) {
                    pageCurrent = 0;
                }
                CDUAvailableArrivalsPage.ShowPage(mcdu, airport, pageCurrent, starSelection);
            };
            down = true;
        }
        mcdu.setArrows(up, down, true, true);
        mcdu.setTemplate([
            ["ARRIVAL {small}TO{end} {green}" + airport.ident + "{end}"],
            ["{sp}APPR", "STAR{sp}", "{sp}VIA"],
            [selectedApproachCell + "[color]" + planColor, selectedStarCell + "[color]" + planColor, "{sp}" + selectedViasCell + "[color]" + planColor],
            [viasPageLabel, "TRANS{sp}"],
            [viasPageLine, selectedTransitionCell + "[color]" + planColor],
            [starSelection ? "STARS" : "APPR", starSelection ? "TRANS" : "", "AVAILABLE"],
            rows[0],
            rows[1],
            rows[2],
            rows[3],
            rows[4],
            rows[5],
            bottomLine
        ]);
        mcdu.onPrevPage = () => {
            CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, !starSelection);
        };
        mcdu.onNextPage = mcdu.onPrevPage;
    }

    static ShowViasPage(mcdu, airport, pageCurrent = 0) {
        const airportInfo = airport.infos;
        const selectedStarIndex = mcdu.flightPlanManager.getArrivalProcIndex();
        if (airportInfo instanceof AirportInfo) {
            mcdu.clearDisplay();
            mcdu.page.Current = mcdu.page.AvailableArrivalsPageVias;
            let selectedApproachCell = "---";
            let selectedApproachCellColor = "white";
            let selectedViasCell = "NONE";
            let selectedViasCellColor = "white";
            const selectedApproach = mcdu.flightPlanManager.getApproach();
            if (selectedApproach) {
                selectedApproachCell = Avionics.Utils.formatRunway(selectedApproach.name);
                selectedApproachCellColor = mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1 ? "yellow" : "green";
                const selectedApproachTransition = selectedApproach.transitions[mcdu.flightPlanManager.getApproachTransitionIndex()];
                if (selectedApproachTransition) {
                    selectedViasCell = selectedApproachTransition.name;
                    selectedViasCellColor = mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1 ? "yellow" : "green";
                }
            }
            let selectedStarCell = "------";
            let selectedStarCellColor = "white";
            const selectedArrival = airportInfo.arrivals[selectedStarIndex];
            if (selectedArrival) {
                selectedStarCell = selectedArrival.name;
                selectedStarCellColor = mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1 ? "yellow" : "green";
            }
            const rows = [[""], [""], [""], [""], [""], [""]];
            for (let i = 0; i < 3; i++) {
                const index = i + pageCurrent;
                if (selectedApproach) {
                    const approachTransition = selectedApproach.transitions[index];
                    if (approachTransition) {
                        let color = "cyan";
                        if (index === mcdu.flightPlanManager.getApproachTransitionIndex()) {
                            color = "green";
                        }
                        rows[2 * i + 1][0] = "{" + approachTransition.name + "[color]" + color;
                        mcdu.onLeftInput[i + 2] = () => {
                            mcdu.setApproachTransitionIndex(index, () => {
                                CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                            });
                        };
                    }
                }
            }
            let bottomLine = ["<RETURN"];
            if (mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1) {
                bottomLine = ["{ERASE[color]amber", "INSERT*[color]amber"];

                mcdu.onLeftInput[5] = async () => {
                    mcdu.eraseTemporaryFlightPlan(() => {
                        CDUFlightPlanPage.ShowPage(mcdu);
                    });
                };

                mcdu.onRightInput[5] = async () => {
                    mcdu.flightPlanService.temporaryInsert();

                    mcdu.updateTowerHeadwind();
                    mcdu.updateConstraints();
                    CDUPerformancePage.UpdateThrRedAccFromDestination(mcdu);
                    CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                };
            } else {
                mcdu.onLeftInput[5] = () => {
                    CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                };
            }
            mcdu.setTemplate([
                ["APPROACH VIAS"],
                ["{sp}APPR", "STAR{sp}", "{sp}VIA"],
                [selectedApproachCell + "[color]" + selectedApproachCellColor , selectedStarCell + "[color]" + selectedStarCellColor, "{sp}" + selectedViasCell + "[color]" + selectedViasCellColor],
                ["APPR VIAS"],
                ["{NO VIAS[color]cyan"],
                rows[0],
                rows[1],
                rows[2],
                rows[3],
                rows[4],
                rows[5],
                rows[6],
                bottomLine
            ]);
            mcdu.onLeftInput[1] = () => {
                mcdu.setApproachTransitionIndex(-1, () => {
                    CDUAvailableArrivalsPage.ShowPage(mcdu, airport, 0, true);
                });
            };
            let up = false;
            let down = false;

            if (pageCurrent < selectedApproach.transitions.length - 3) {
                mcdu.onUp = () => {
                    pageCurrent++;
                    if (pageCurrent < 0) {
                        pageCurrent = 0;
                    }
                    CDUAvailableArrivalsPage.ShowViasPage(mcdu, airport, pageCurrent);
                };
                up = true;
            }
            if (pageCurrent > 0) {
                mcdu.onDown = () => {
                    pageCurrent--;
                    if (pageCurrent < 0) {
                        pageCurrent = 0;
                    }
                    CDUAvailableArrivalsPage.ShowViasPage(mcdu, airport, pageCurrent);
                };
                down = true;
            }
            mcdu.setArrows(up, down, true, true);
        }
    }
}
