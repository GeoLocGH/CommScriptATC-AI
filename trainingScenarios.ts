import { TrainingScenario } from './types';

export const SCENARIOS: TrainingScenario[] = [
  {
    key: 'initial_contact',
    name: 'Initial Contact',
    atcInstruction: "Springfield Tower, {callsign}, 10 miles north with information Charlie, request landing.",
    expectedReadback: "{callsign}, Springfield Tower, report a 3-mile final for runway 2-8 Right.",
  },
  {
    key: 'taxi_to_runway',
    name: 'Taxi to Runway',
    atcInstruction: "{callsign}, taxi to runway 1-9er via taxiway Alpha, hold short of runway 1-9er.",
    expectedReadback: "Taxi to runway 1-9er via Alpha, hold short runway 1-9er, {callsign}.",
  },
  {
    key: 'line_up_and_wait',
    name: 'Line Up and Wait',
    atcInstruction: "{callsign}, runway 2-8 Right, line up and wait.",
    expectedReadback: "Runway 2-8 Right, line up and wait, {callsign}.",
  },
  {
    key: 'takeoff_clearance',
    name: 'Takeoff Clearance',
    atcInstruction: "{callsign}, wind 2-1-0 at 8, runway 2-8 Right, cleared for takeoff.",
    expectedReadback: "Cleared for takeoff, runway 2-8 Right, {callsign}.",
  },
  {
    key: 'altitude_heading',
    name: 'Altitude and Heading',
    atcInstruction: "{callsign}, turn right heading 0-9-0, climb and maintain five thousand.",
    expectedReadback: "Right heading 0-9-0, climb and maintain five thousand, {callsign}.",
  },
  {
    key: 'traffic_advisory',
    name: 'Traffic Advisory',
    atcInstruction: "{callsign}, traffic 1 o'clock, 4 miles, southbound, a Cessna 172 at four thousand five hundred.",
    expectedReadback: "Looking for traffic, {callsign}.",
  },
  {
    key: 'frequency_change',
    name: 'Frequency Change',
    atcInstruction: "{callsign}, contact departure on 1-2-4 point 5.",
    expectedReadback: "Contact departure, 1-2-4 point 5, {callsign}.",
  },
  {
    key: 'vfr_flight_following',
    name: 'VFR Flight Following',
    atcInstruction: "{callsign}, squawk 4-3-2-1, radar contact 5 miles east of Capital City airport, altimeter 2-9-9-2.",
    expectedReadback: "Squawk 4-3-2-1, altimeter 2-9-9-2, {callsign}.",
  },
  {
    key: 'holding_instructions',
    name: 'Holding Instructions',
    atcInstruction: "{callsign}, hold northeast of the Springfield VOR on the 0-4-5 radial, 10-mile legs, left turns, maintain seven thousand.",
    expectedReadback: "Hold northeast of Springfield VOR, 0-4-5 radial, 10-mile legs, left turns, maintain seven thousand, {callsign}.",
  },
  {
    key: 'ils_approach_clearance',
    name: 'ILS Approach Clearance',
    atcInstruction: "{callsign}, 5 miles from GRIFF, turn right heading 2-5-0, maintain three thousand until established on the localizer, cleared ILS runway 2-8 Right approach.",
    expectedReadback: "Right heading 2-5-0, maintain three thousand until established, cleared ILS runway 2-8 Right approach, {callsign}.",
  },
  {
    key: 'landing_clearance',
    name: 'Landing Clearance',
    atcInstruction: "{callsign}, wind 2-7-0 at 1-2 gusting 1-8, runway 2-8 Right, cleared to land.",
    expectedReadback: "Cleared to land runway 2-8 Right, {callsign}.",
  },
  {
    key: 'go_around',
    name: 'Go Around',
    atcInstruction: "{callsign}, go around, fly runway heading, climb and maintain three thousand.",
    expectedReadback: "Going around, runway heading, climb and maintain three thousand, {callsign}.",
  },
  {
    key: 'mayday_emergency',
    name: 'MAYDAY - Emergency Landing',
    atcInstruction: "{callsign}, roger MAYDAY. Fly heading 1-8-0, descend and maintain two thousand five hundred. The airport is at your 12 o'clock, 10 miles.",
    expectedReadback: "Heading 1-8-0, descend and maintain two thousand five hundred, {callsign}."
  },
  {
    key: 'ctaf_sequencing',
    name: 'CTAF - Sequencing Behind Traffic',
    atcInstruction: "Mountain Valley traffic, Skyhawk Niner-Seven-Xray is midfield downwind runway one-seven, touch and go, Mountain Valley.",
    expectedReadback: "{callsign} is number two on the downwind behind the Skyhawk, Mountain Valley traffic."
  },
  {
    key: 'mountain_turbulence',
    name: 'Mountain - Altimeter & Turbulence',
    atcInstruction: "{callsign}, check altimeter 3-0-1-2. Be advised, moderate turbulence reported below one-four thousand over the divide.",
    expectedReadback: "Three-zero-one-two, will watch for the turbulence, {callsign}."
  },
  {
    key: 'class_bravo_transition',
    name: 'Class Bravo Transition',
    atcInstruction: "{callsign}, cleared through the Class Bravo airspace via the coliseum route, maintain VFR at or below three thousand five hundred.",
    expectedReadback: "Cleared through the Class Bravo via the coliseum route, at or below three thousand five hundred, {callsign}."
  },
  {
    key: 'sid_clearance',
    name: 'SID Clearance (Lubbock Six)',
    atcInstruction: "{callsign}, cleared to Dallas Fort Worth airport via the Lubbock Six departure, then as filed. Climb and maintain one-zero thousand, expect flight level two-four-zero one-zero minutes after departure.",
    expectedReadback: "Cleared to Dallas Fort Worth, Lubbock Six departure, then as filed. Maintain one-zero thousand, expect two-four-zero in one-zero, {callsign}."
  },
  {
    key: 'star_clearance',
    name: 'STAR Clearance (Cowboy Three)',
    atcInstruction: "{callsign}, descend via the Cowboy Three arrival, except cross LARRK at and maintain one-one thousand. Altimeter two-niner-niner-eight.",
    expectedReadback: "Descend via the Cowboy Three arrival, cross LARRK at one-one thousand, altimeter two-niner-niner-eight, {callsign}."
  }
];
