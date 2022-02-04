const MAX_FIX_ROW = 5;

const Markers = {
    FPLN_DISCONTINUITY: ["---F-PLN DISCONTINUITY--"],
    END_OF_FPLN:        ["------END OF F-PLN------"],
    NO_ALTN_FPLN:       ["-----NO ALTN F-PLN------"],
    END_OF_ALTN_FPLN:   ["---END OF ALT F-PLN----"],
    TOO_STEEP_PATH:     ["-----TOO STEEP PATH-----"]
};

class CDUFlightPlanPage {
    static ShowPage(mcdu, offset = 0, planIndex) {
        const isTemporary = mcdu.flightPlanService.hasTemporary;
        const isSecondary = !isTemporary && !!planIndex;

        // INIT
        function addLskAt(index, delay, callback) {
            mcdu.leftInputDelay[index] = (typeof delay === 'function') ? delay : () => delay;
            mcdu.onLeftInput[index] = callback;
        }

        function addRskAt(index, delay, callback) {
            mcdu.rightInputDelay[index] = (typeof delay === 'function') ? delay : () => delay;
            mcdu.onRightInput[index] = callback;
        }

        function getRunwayInfo(runway) {
            let runwayText, runwayAlt;
            if (runway) {
                runwayText = Avionics.Utils.formatRunway(runway.designation);
                runwayAlt = (runway.elevation * 3.280).toFixed(0).toString();
            }
            return [runwayText, runwayAlt];
        }

        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.FlightPlanPage;
        mcdu.returnPageCallback = () => {
            CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
        };
        mcdu.activeSystem = 'FMGC';
        CDUFlightPlanPage._timer = 0;

        const concernedPlan = !planIndex ? mcdu.flightPlanService.activeOrTemporary : mcdu.flightPlanService.secondary(1);
        const renderedWaypointIndex = concernedPlan.activeWaypointIndex;

        mcdu.pageUpdate = () => {
            CDUFlightPlanPage._timer++;
            if (CDUFlightPlanPage._timer >= 100 || concernedPlan.activeWaypointIndex !== renderedWaypointIndex) {
                CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
            }
        };
        const flightPhase = SimVar.GetSimVarValue("L:A32NX_FWC_FLIGHT_PHASE", "Enum");
        const isFlying = flightPhase >= 5 && flightPhase <= 7;

        let showFrom = false;
        let planTypeHeader = '';
        // TODO FIXME: Correct FMS lateral position calculations and move logic from F-PLN A
        // 22-70-00:11
        const adirLat = ADIRS.getLatitude();
        const adirLong = ADIRS.getLongitude();
        const ppos = (adirLat.isNormalOperation() && adirLong.isNormalOperation()) ? {
            lat: ADIRS.getLatitude().value,
            long: ADIRS.getLongitude().value,
        } : {
            lat: NaN,
            long: NaN
        };
        // TODO port over
        const stats = concernedPlan.computeWaypointStatistics();

        // TODO FIXME: Move from F-PLN A
        const utcTime = SimVar.GetGlobalVarValue("ZULU TIME", "seconds");
        if (concernedPlan.originAirport) {
            if (!isFlying) {
                mcdu.flightPlanService._waypointReachedAt = utcTime;
            }
        }

        const waypointsAndMarkers = [];

        // PWPs
        const fmsPseudoWaypoints = mcdu.guidanceController.currentPseudoWaypoints;

        const destIndex = concernedPlan.destinationLegIndex;

        // Primary F-PLAN
        for (let i = 0; i < concernedPlan.legCount; i++) {
            const pseudoWaypointsOnLeg = fmsPseudoWaypoints.filter((it) => it.displayedOnMcdu && it.alongLegIndex === i);

            if (pseudoWaypointsOnLeg) {
                waypointsAndMarkers.push(...pseudoWaypointsOnLeg.map((pwp) => ({ pwp, fpIndex: i })));
            }

            const element = concernedPlan.elementAt(i);

            if (element.isDiscontinuity) {
                waypointsAndMarkers.push({ marker: Markers.FPLN_DISCONTINUITY, fpIndex: i});
            } else {
                if (element.type === 14) {
                    waypointsAndMarkers.push({ holdResumeExit: wp, fpIndex: i });
                }

                waypointsAndMarkers.push({ wp: element, fpIndex: i});
            }

            if (i === concernedPlan.legCount - 1) {
                waypointsAndMarkers.push({ marker: Markers.END_OF_FPLN, fpIndex: i});

                if (!concernedPlan.alternateDestinationAirport) {
                    waypointsAndMarkers.push({ marker: Markers.NO_ALTN_FPLN, fpIndex: i});
                }
            }
        }
        // TODO: Alt F-PLAN

        // Render F-PLAN Display

        // fprow:   1      | 2     | 3 4   | 5 6   | 7 8   | 9 10  | 11 12   |
        // display: SPD/ALT| R0    | R1    | R2    | R3    | R4    | DEST    | SCRATCHPAD
        // functions:      | F[0]  | F[1]  | F[2]  | F[3]  | F[4]  | F[5]    |
        //                 | FROM  | TO    |
        let rowsCount = 5;

        if (waypointsAndMarkers.length === 0) {
            rowsCount = 0;
            mcdu.setTemplate([
                [`{left}{small}{sp}${showFrom ? "FROM" : "{sp}{sp}{sp}{sp}"}{end}{sp}${planTypeHeader}{end}{right}{small}${SimVar.GetSimVarValue("ATC FLIGHT NUMBER", "string", "FMC")}{sp}{sp}{sp}{end}{end}`],
                ...emptyFplnPage()
            ]);
            mcdu.onLeftInput[0] = () => CDULateralRevisionPage.ShowPage(mcdu);
            return;
        } else if (waypointsAndMarkers.length >= 5) {
            rowsCount = 5;
        } else {
            rowsCount = waypointsAndMarkers.length;
        }

        // Only examine first 5 (or less) waypoints/markers
        const scrollWindow = [];
        for (let rowI = 0, winI = offset; rowI < rowsCount; rowI++, winI++) {
            winI = winI % (waypointsAndMarkers.length);

            const {wp, pwp, marker, holdResumeExit, fpIndex} = waypointsAndMarkers[winI];
            const {fpIndex: prevFpIndex} = (winI > 0) ? waypointsAndMarkers[winI - 1] : { fpIndex: null};

            if (wp) {
                // Waypoint
                if (offset === 0) {
                    showFrom = true;
                }

                const wpActive = (fpIndex >= concernedPlan.activeWaypointIndex);
                const ident = wp.ident;
                const isOverfly = wp.overfly;

                // Time
                let time;
                let timeCell = "----[s-text]";
                if (ident !== "MANUAL") {
                    if (isFlying) {
                        if (fpIndex === destIndex || isFinite(wp.liveUTCTo) || isFinite(wp.waypointReachedAt)) {
                            time = (fpIndex === destIndex || wpActive || ident === "(DECEL)") ? stats.get(fpIndex).etaFromPpos : wp.waypointReachedAt;
                            timeCell = `${FMCMainDisplay.secondsToUTC(time)}[s-text]`;
                        }
                    } else {
                        if (fpIndex === destIndex || isFinite(wp.liveETATo)) {
                            time = (fpIndex === destIndex || wpActive || ident === "(DECEL)") ? stats.get(fpIndex).timeFromPpos : 0;
                            timeCell = `${FMCMainDisplay.secondsTohhmm(time)}[s-text]`;
                        }
                    }
                }

                // Color
                let color = "green";
                if (mcdu.flightPlanService.hasTemporary) {
                    color = "yellow";
                } else if (planIndex >= Fmgc.FlightPlanIndex.FirstSecondary) {
                    color = "white";
                } else if (fpIndex === concernedPlan.activeWaypointIndex) {
                    color = "white";
                }

                // Fix Header
                const fixAnnotation = wp.annotation;

                // Bearing/Track
                // TODO port over
                const bearingTrack = "";
                // if (wpPrev && wp.additionalData.legType !== 14 /* HM */) {
                //     const magVar = Facilities.getMagVar(wpPrev.infos.coordinates.lat, wpPrev.infos.coordinates.long);
                //     switch (rowI) {
                //         case 1:
                //             if (mcdu.flightPlanService.activeOrTemporary.activeWaypointIndex === fpIndex) {
                //                 const br = mcdu.flightPlanService.getBearingToActiveWaypoint();
                //                 const bearing = A32NX_Util.trueToMagnetic(br, magVar);
                //                 bearingTrack = `BRG${bearing.toFixed(0).toString().padStart(3,"0")}\u00b0`;
                //             }
                //             break;
                //         case 2:
                //             const tr = Avionics.Utils.computeGreatCircleHeading(wpPrev.infos.coordinates, wp.infos.coordinates);
                //             const track = A32NX_Util.trueToMagnetic(tr, magVar);
                //             bearingTrack = `{${mcdu.flightPlanService.hasTemporary ? "yellow" : "green"}}TRK${track.toFixed(0).padStart(3,"0")}\u00b0{end}`;
                //             break;
                //     }
                // }
                // Distance
                const distance = "";

                // Active waypoint is live distance, others are distances in the flight plan
                // TODO FIXME: actually use the correct prediction
                // TODO port over
                // if (fpIndex === mcdu.flightPlanService.getActiveWaypointIndex()) {
                //     distance = stats.get(fpIndex).distanceFromPpos.toFixed(0);
                // } else {
                //     distance = stats.get(fpIndex).distanceInFP.toFixed(0);
                // }
                // if (distance > 9999) {
                //     distance = 9999;
                // }
                // distance = distance.toString();
                //
                const speedConstraint = "---";
                // if (wp.speedConstraint > 10 && ident !== "MANUAL") {
                //     speedConstraint = `{magenta}*{end}${wp.speedConstraint.toFixed(0)}`;
                // }

                let altColor = color;
                let spdColor = color;
                let timeColor = color;

                // Altitude
                let altitudeConstraint = "-----";
                const altPrefix = "\xa0";
                if (fpIndex === destIndex) {
                    // Only for destination waypoint, show runway elevation.
                    // altColor = "white";
                    // spdColor = "white";
                    // const { elevation } = mcdu.flightPlanService.activeOrTemporary.destinationRunway;
                    //
                    // if (elevation) {
                    //     altPrefix = "{magenta}*{end}";
                    //     altitudeConstraint = (Math.round((parseInt(elevation) + 50) / 10) * 10).toString();
                    //     altColor = color;
                    // }
                    // altitudeConstraint = altitudeConstraint.padStart(5,"\xa0");

                } else if (fpIndex === 0) {
                    // const { elevation } = mcdu.flightPlanService.activeOrTemporary.originRunway;
                    // if (elevation) {
                    //     altitudeConstraint = elevation;
                    //     altColor = color;
                    // }
                    // altitudeConstraint = altitudeConstraint.padStart(5,"\xa0");
                } else if (ident !== "MANUAL") {
                    const firstRouteIndex = 0;
                    const lastRouteIndex = concernedPlan.legCount - 1;
                    //const departureWp = firstRouteIndex > 1 && mcdu.flightPlanService.getDepartureWaypoints().indexOf(wp) !== -1;
                    //
                    // if (mcdu.flightPlanService.getOriginTransitionAltitude() >= 100 && wp.legAltitude1 > mcdu.flightPlanService.getOriginTransitionAltitude()) {
                    //     altitudeConstraint = (wp.legAltitude1 / 100).toFixed(0).toString();
                    //     altitudeConstraint = `FL${altitudeConstraint.padStart(3,"0")}`;
                    // } else {
                    //     altitudeConstraint = wp.legAltitude1.toFixed(0).toString().padStart(5,"\xa0");
                    // }

                    if ((fpIndex === firstRouteIndex - 1) || (fpIndex === lastRouteIndex + 1)) {
                        if (Object.is(NaN, mcdu.cruiseFlightLevel)) {
                            altitudeConstraint = "-----";
                        } else {
                            altitudeConstraint = `FL${mcdu.cruiseFlightLevel.toString().padStart(3,"0")}`;
                        }
                        if (fpIndex !== -42) {
                            mcdu.leftInputDelay[rowI] = (value) => {
                                if (value === "") {
                                    if (waypoint) {
                                        return mcdu.getDelaySwitchPage();
                                    }
                                }
                                return mcdu.getDelayBasic();
                            };
                            mcdu.onLeftInput[rowI] = async (value, scratchpadCallback) => {
                                if (value === "") {
                                    if (waypoint) {
                                        CDULateralRevisionPage.ShowPage(mcdu, waypoint, fpIndex);
                                    }
                                } else if (value === FMCMainDisplay.clrValue) {
                                    mcdu.removeWaypoint(fpIndex, () => {
                                        CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                    });
                                } else if (value.length > 0) {
                                    mcdu.insertWaypoint(value, fpIndex, (success) => {
                                        if (!success) {
                                            scratchpadCallback();
                                        }
                                        CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                    });
                                }
                            };
                            mcdu.rightInputDelay[rowI] = () => {
                                return mcdu.getDelaySwitchPage();
                            };
                            mcdu.onRightInput[rowI] = async () => {
                                if (waypoint) {
                                    CDUVerticalRevisionPage.ShowPage(mcdu, waypoint);
                                }
                            };
                        }
                    // Waypoint is in between on the route
                    } else if (fpIndex <= lastRouteIndex && fpIndex >= firstRouteIndex) {
                        if (Object.is(NaN, mcdu.cruiseFlightLevel)) {
                            altitudeConstraint = "-----";
                        } else {
                            altitudeConstraint = `FL${mcdu.cruiseFlightLevel.toString().padStart(3,"0")}`;
                        }
                    // Waypoint with no alt constraint
                    } else {
                        altitudeConstraint = "-----";
                    }
                }

                if (speedConstraint === "---") {
                    spdColor = "white";
                }

                if (altitudeConstraint === "-----") {
                    altColor = "white";
                }

                if (fpIndex === concernedPlan.destinationLegIndex) {
                    timeColor = color;
                } else {
                    timeColor = "white";
                }

                let wptColor = color;
                if (fpIndex >= concernedPlan.firstMissedApproachLeg) {
                    wptColor = 'cyan';
                }

                scrollWindow[rowI] = {
                    fpIndex: fpIndex,
                    active: wpActive,
                    ident: ident,
                    color: wptColor,
                    distance: distance,
                    spdColor: spdColor,
                    speedConstraint: speedConstraint,
                    altColor: altColor,
                    altitudeConstraint: { alt: altitudeConstraint, altPrefix: altPrefix },
                    timeCell: timeCell,
                    timeColor: timeColor,
                    fixAnnotation: fixAnnotation,
                    bearingTrack: bearingTrack,
                    isOverfly: isOverfly,
                };

                if (fpIndex !== concernedPlan.destinationLegIndex) {
                    addLskAt(rowI,
                        (value) => {
                            if (value === "") {
                                return mcdu.getDelaySwitchPage();
                            }
                            return mcdu.getDelayBasic();
                        },
                        (value, scratchpadCallback) => {
                            switch (value) {
                                case "":
                                    CDULateralRevisionPage.ShowPage(mcdu, wp, fpIndex);
                                    break;
                                case FMCMainDisplay.clrValue:
                                    if (fpIndex <= concernedPlan.activeWaypointIndex) {
                                        // 22-72-00:67
                                        // Stop clearing TO or FROM waypoints when NAV is engaged
                                        const lateralMode = SimVar.GetSimVarValue("L:A32NX_FMA_LATERAL_MODE", "Number");
                                        switch (lateralMode) {
                                            case 20:
                                            case 30:
                                            case 31:
                                            case 32:
                                            case 33:
                                            case 34:
                                            case 50:
                                                mcdu.addNewMessage(NXSystemMessages.notAllowedInNav);
                                                scratchpadCallback();
                                                return;
                                        }
                                    }
                                    mcdu.removeWaypoint(fpIndex, () => {
                                        CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                    }, !mcdu.flightPlanService.hasTemporary);
                                    break;
                                case FMCMainDisplay.ovfyValue:
                                    if (wp.additionalData.overfly) {
                                        mcdu.removeWaypointOverfly(fpIndex, () => {
                                            CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                        }, !mcdu.flightPlanService.hasTemporary);
                                    } else {
                                        mcdu.addWaypointOverfly(fpIndex, () => {
                                            CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                        }, !mcdu.flightPlanService.hasTemporary);
                                    }
                                    break;
                                default:
                                    if (value.length > 0) {
                                        mcdu.insertWaypoint(value, fpIndex, (success) => {
                                            if (!success) {
                                                scratchpadCallback();
                                            }
                                            CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                        }, !mcdu.flightPlanService.hasTemporary);
                                    }
                                    break;
                            }
                        });
                } else {
                    addLskAt(rowI, () => mcdu.getDelaySwitchPage(),
                        (value, scratchpadCallback) => {
                            if (value === "") {
                                CDULateralRevisionPage.ShowPage(mcdu, concernedPlan.destinationLeg, fpIndex);
                            } else if (value.length > 0) {
                                mcdu.insertWaypoint(value, fpIndex, (success) => {
                                    if (!success) {
                                        scratchpadCallback();
                                    }
                                    CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                                }, true);
                            }
                        });
                }

                addRskAt(rowI, () => mcdu.getDelaySwitchPage(),
                    async (_value) => {
                        CDUVerticalRevisionPage.ShowPage(mcdu, wp);
                    });

            } else if (pwp) {
                scrollWindow[rowI] = {
                    fpIndex: fpIndex,
                    active: false,
                    ident: pwp.ident,
                    color: (mcdu.flightPlanService.hasTemporary) ? "yellow" : "green",
                    distance: Math.round(pwp.stats.distanceInFP).toString(),
                    spdColor: "white",
                    speedConstraint: "---",
                    altColor: 'white',
                    altitudeConstraint: { alt: "-----", altPrefix: "\xa0" },
                    timeCell: "----[s-text]",
                    timeColor: "white",
                    fixAnnotation: "",
                    bearingTrack: pwp.stats.bearingInFp,
                    isOverfly: false,
                };
            } else if (marker) {

                // Marker
                scrollWindow[rowI] = waypointsAndMarkers[winI];
                addLskAt(rowI, 0, (value, scratchpadCallback) => {
                    if (value === FMCMainDisplay.clrValue) {
                        mcdu.clearDiscontinuity(fpIndex, () => {
                            CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                        }, !mcdu.flightPlanService.hasTemporary);
                        return;
                    }

                    mcdu.insertWaypoint(value, fpIndex + 1, (success) => {
                        if (!success) {
                            scratchpadCallback();
                        }
                        CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
                    }, !mcdu.flightPlanService.hasTemporary);
                });
            } else if (holdResumeExit) {
                const isActive = fpIndex === fpm.getActiveWaypointIndex();
                const isNext = fpIndex === (fpm.getActiveWaypointIndex() + 1);
                let color = "green";
                if (fpm.isCurrentFlightPlanTemporary()) {
                    color = "yellow";
                } else if (isActive) {
                    color = "white";
                }

                const decelReached = isActive || isNext && mcdu.holdDecelReached;
                let holdSpeed = holdResumeExit.additionalData.holdSpeed ? holdResumeExit.additionalData.holdSpeed.toFixed(0) : '---';
                if ((isActive || isNext) && mcdu.holdSpeedTarget > 0) {
                    holdSpeed = mcdu.holdSpeedTarget.toFixed(0);
                }
                const turnDirection = holdResumeExit.turnDirection === 1 ? 'L' : 'R';
                // prompt should only be shown once entering decel for hold (3 - 20 NM before hold)
                const immExit = decelReached && !holdResumeExit.additionalData.immExit;
                const resumeHold = decelReached && holdResumeExit.additionalData.immExit;

                scrollWindow[rowI] = {
                    fpIndex,
                    holdResumeExit,
                    color,
                    immExit,
                    resumeHold,
                    holdSpeed,
                    turnDirection,
                };

                addLskAt(rowI, 0, (value, scratchpadCallback) => {
                    CDUHoldAtPage.ShowPage(mcdu, holdResumeExit, fpIndex);
                    scratchpadCallback();
                });

                addRskAt(rowI, 0, (value, scratchpadCallback) => {
                    // IMM EXIT, only active once reaching decel
                    if (isActive) {
                        mcdu.fmgcMesssagesListener.triggerToAllSubscribers('A32NX_IMM_EXIT', fpIndex, immExit);
                        CDUFlightPlanPage.ShowPage(mcdu, offset);
                    } else if (decelReached) {
                        fpm.removeWaypoint(fpIndex, true, () => {
                            CDUFlightPlanPage.ShowPage(mcdu, offset);
                        });
                    }
                    scratchpadCallback();
                });
            }
        }

        // Pass current waypoint data to ND
        if (scrollWindow[1]) {
            mcdu.currentFlightPlanWaypointIndex = scrollWindow[1].fpIndex;
            SimVar.SetSimVarValue("L:A32NX_SELECTED_WAYPOINT", "number", scrollWindow[1].fpIndex);
        } else if (scrollWindow[0]) {
            mcdu.currentFlightPlanWaypointIndex = scrollWindow[0].fpIndex;
            SimVar.SetSimVarValue("L:A32NX_SELECTED_WAYPOINT", "number", scrollWindow[0].fpIndex);
        } else {
            mcdu.currentFlightPlanWaypointIndex = first + offset;
            SimVar.SetSimVarValue("L:A32NX_SELECTED_WAYPOINT", "number", first + offset);
        }

        // Render scrolling data to text >> add ditto marks

        let firstWp = scrollWindow.length;
        const scrollText = [];
        for (let rowI = 0; rowI < scrollWindow.length; rowI++) {
            const { marker: cMarker, pwp: cPwp, holdResumeExit: cHold, speedConstraint: cSpd, altitudeConstraint: cAlt } = scrollWindow[rowI];
            let spdRpt = false;
            let altRpt = false;
            let showFix = true;
            let showDist = true;
            let showNm = false;

            if (cHold) {
                const { color, immExit, resumeHold, holdSpeed, turnDirection } = scrollWindow[rowI];
                scrollText[(rowI * 2) - 1] = ['', `{amber}${immExit ? 'IMM\xa0\xa0' : ''}${resumeHold ? 'RESUME' : ''}{end}`, 'HOLD\xa0\xa0\xa0\xa0\xa0'];
                scrollText[(rowI * 2)] = [`{${color}}HOLD ${turnDirection}{end}`, `{amber}${immExit ? 'EXIT*' : ''}${resumeHold ? 'HOLD*' : ''}{end}`, `{${color}}{small}{white}SPD{end}\xa0${holdSpeed}{end}{end}`];
            } else if (!cMarker && !cPwp) { // Waypoint
                if (rowI > 0) {
                    const { marker: pMarker, pwp: pPwp, holdResumeExit: pHold, speedConstraint: pSpd, altitudeConstraint: pAlt} = scrollWindow[rowI - 1];
                    if (!pMarker && !pPwp && !pHold) {
                        firstWp = Math.min(firstWp, rowI);
                        if (rowI === firstWp) {
                            showNm = true;
                        }
                        if (cSpd !== "---" && cSpd === pSpd) {
                            spdRpt = true;
                        }

                        if (cAlt.alt !== "-----" &&
                            cAlt.alt === pAlt.alt &&
                            cAlt.altPrefix === pAlt.altPrefix) {
                            altRpt = true;
                        }
                    // If previous row is a marker, clear all headers
                    } else if (!pHold) {
                        showDist = false;
                        showFix = false;
                    }
                }

                scrollText[(rowI * 2) - 1] = renderFixHeader(scrollWindow[rowI], showNm, showDist, showFix);
                scrollText[(rowI * 2)] = renderFixContent(scrollWindow[rowI], spdRpt, altRpt);

            // Marker
            } else {
                scrollText[(rowI * 2) - 1] = [];
                scrollText[(rowI * 2)] = cMarker;
            }
        }

        // Destination (R6)

        const destText = [];
        if (isTemporary) {
            destText[0] = [" ", " "];
            destText[1] = ["{ERASE[color]amber", "INSERT*[color]amber"];

            planTypeHeader = '{yellow}TMPY{end}';

            addLskAt(5, 0, async () => {
                mcdu.eraseTemporaryFlightPlan(() => {
                    CDUFlightPlanPage.ShowPage(mcdu, 0, planIndex);
                });
            });
            addRskAt(5, 0, async () => {
                mcdu.flightPlanService.temporaryInsert();

                CDUFlightPlanPage.ShowPage(mcdu, 0, planIndex);
            });
        } else {
            if (isSecondary) {
                planTypeHeader = 'SEC';
            }

            let destCell = "----";
            let destinationRunway = null;
            if (concernedPlan.destinationAirport) {
                destCell = concernedPlan.destinationAirport.ident;
                destinationRunway = concernedPlan.destinationRunway;
                if (destinationRunway) {
                    destCell += destinationRunway.ident;
                }
            }
            let destTimeCell = "----";
            let destDistCell = "---";
            let destEFOBCell = "---";

            if (concernedPlan.destinationAirport) {
                const destStats = stats.get(concernedPlan.legCount - 1);

                if (destStats) {
                    destDistCell = destStats.distanceFromPpos.toFixed(0);
                    destEFOBCell = (NXUnits.kgToUser(mcdu.getDestEFOB(isFlying))).toFixed(1);
                    if (isFlying) {
                        destTimeCell = FMCMainDisplay.secondsToUTC(destStats.etaFromPpos);
                    } else {
                        destTimeCell = FMCMainDisplay.secondsTohhmm(destStats.timeFromPpos);
                    }
                }
            }
            if (!CDUInitPage.fuelPredConditionsMet(mcdu)) {
                destEFOBCell = "---";
            }

            destText[0] = ["\xa0DEST", "DIST EFOB", isFlying ? "UTC{sp}" : "TIME{sp}{sp}"];
            destText[1] = [destCell, `${destDistCell} ${destEFOBCell}`, `${destTimeCell}{sp}{sp}`];

            addLskAt(5, () => mcdu.getDelaySwitchPage(),
                () => {
                    CDULateralRevisionPage.ShowPage(mcdu, concernedPlan.destinationLeg, concernedPlan.legCount - 1);
                });
        }

        // scrollText pad to 9 rows
        while (scrollText.length < 9) {
            scrollText.push([""]);
        }
        const allowScroll = waypointsAndMarkers.length > 4;
        if (allowScroll) {//scroll only if there are more than 5 points
            mcdu.onDown = () => {//on page down decrement the page offset.
                if (offset > 0) { // if page not on top
                    offset--;
                } else { // else go to the bottom
                    offset = waypointsAndMarkers.length - 1;
                }
                CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
            };
            mcdu.onUp = () => {
                if (offset < waypointsAndMarkers.length - 1) { // if page not on bottom
                    offset++;
                } else { // else go on top
                    offset = 0;
                }
                CDUFlightPlanPage.ShowPage(mcdu, offset, planIndex);
            };
        }
        mcdu.setArrows(allowScroll, allowScroll, true, true);
        mcdu.setTemplate([
            [`{left}{small}{sp}${showFrom ? "FROM" : "{sp}{sp}{sp}{sp}"}{end}{sp}${planTypeHeader}{end}{right}{small}${SimVar.GetSimVarValue("ATC FLIGHT NUMBER", "string", "FMC")}{sp}{sp}{sp}{end}{end}`],
            ["", "SPD/ALT\xa0\xa0\xa0", isFlying ? "\xa0UTC{sp}" : "TIME{sp}{sp}"],
            ...scrollText,
            ...destText
        ]);
    }
}

CDUFlightPlanPage._timer = 0;

function renderFixTableHeader(isFlying) {
    return [
        `{sp}\xa0FROM`,
        "SPD/ALT\xa0\xa0\xa0",
        isFlying ? "\xa0UTC{sp}" : "TIME{sp}{sp}"
    ];
}

function renderFixHeader(rowObj, showNm = false, showDist = true, showFix = true) {
    const { fixAnnotation, color, distance, bearingTrack } = rowObj;
    return [
        `{sp}${(showFix) ? fixAnnotation : ""}`,
        `${ showDist ? (showNm ? distance + "NM" : distance).padEnd(8, '\xa0') : ""}[color]${color}`,
        bearingTrack,
    ];
}

function renderFixContent(rowObj, spdRepeat = false, altRepeat = false) {
    const {ident, isOverfly, color, spdColor, speedConstraint, altColor, altitudeConstraint, timeCell, timeColor} = rowObj;

    return [
        `${ident}${isOverfly ? FMCMainDisplay.ovfyValue : ""}[color]${color}`,
        `{${spdColor}}${spdRepeat ? "\xa0\"\xa0" : speedConstraint}{end}{${altColor}}/${altRepeat ? "\xa0\xa0\xa0\"\xa0\xa0" : altitudeConstraint.altPrefix + altitudeConstraint.alt}{end}[s-text]`,
        `${timeCell}{sp}{sp}[color]${timeColor}`
    ];
}

function emptyFplnPage() {
    return [
        ["", "SPD/ALT", "TIME{sp}{sp}"],
        ["PPOS[color]green", "---/ -----", "----{sp}{sp}"],
        [""],
        ["---F-PLN DISCONTINUITY---"],
        [""],
        ["------END OF F-PLN-------"],
        [""],
        ["-----NO ALTN F-PLN-------"],
        [""],
        [""],
        ["\xa0DEST", "DIST EFOB", "TIME{sp}{sp}"],
        ["------", "---- ----", "----{sp}{sp}"]
    ];
}
