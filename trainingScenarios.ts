import { TrainingScenario } from './types';

export const BUILT_IN_SCENARIOS: Omit<TrainingScenario, 'id'>[] = [
  {
    title: 'Initial Taxi Clearance',
    description: 'Practice receiving and reading back your initial taxi clearance from the ground controller.',
    category: 'Basic Clearances',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, Boston Ground, Runway Two-Two Right, taxi via Alpha, hold short of Charlie.',
    expectedReadback: 'Runway Two-Two Right, taxi via Alpha, hold short of Charlie, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Altitude Change',
    description: 'Practice responding to a new altitude assignment from the departure controller.',
    category: 'Flight Maneuvers',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, climb and maintain one-zero thousand.',
    expectedReadback: 'Climb and maintain one-zero thousand, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Frequency Change',
    description: 'Practice acknowledging a handoff to a new controller frequency.',
    category: 'Basic Clearances',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, contact Boston Center on one-two-eight point eight.',
    expectedReadback: 'One-two-eight point eight, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Takeoff Clearance',
    description: 'Practice reading back a clearance for takeoff.',
    category: 'Basic Clearances',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, Runway Two-Two Right, wind two-one-zero at one-zero, cleared for takeoff.',
    expectedReadback: 'Cleared for takeoff, Runway Two-Two Right, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Hold Short Instruction',
    description: 'Practice acknowledging an instruction to hold short of an active runway.',
    category: 'Flight Maneuvers',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, hold short of Runway Two-Seven.',
    expectedReadback: 'Holding short Runway Two-Seven, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Holding Pattern Instruction',
    description: 'Practice reading back instructions to enter a holding pattern.',
    category: 'Advanced Procedures',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, hold northeast of the Boston VOR on the zero-niner-zero radial, five mile legs, right turns, maintain six thousand.',
    expectedReadback: 'Hold northeast of the Boston VOR, zero-niner-zero radial, five mile legs, right turns, maintain six thousand, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Amended Route Clearance',
    description: 'Practice reading back a complex amended route clearance.',
    category: 'Advanced Procedures',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, cleared to the Boston airport via direct Providence, Victor one-six, then as filed. Climb and maintain flight level two-four-zero.',
    expectedReadback: 'Cleared to Boston via direct Providence, Victor one-six, then as filed, climb and maintain flight level two-four-zero, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'ILS Approach Clearance',
    description: 'Practice reading back a full instrument approach clearance.',
    category: 'Advanced Procedures',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, seven miles from the outer marker, turn right heading two-five-zero, maintain three thousand until established on the localizer, cleared ILS Runway Two-Two Right approach.',
    expectedReadback: 'Turn right heading two-five-zero, maintain three thousand until established, cleared ILS Runway Two-Two Right approach, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Traffic Advisory',
    description: 'Practice the standard response to an ATC traffic advisory.',
    category: 'Flight Maneuvers',
    atcInstruction: 'November-One-Two-Three-Alpha-Bravo, traffic twelve o-clock, five miles, opposite direction, a Boeing 737 at one-one thousand.',
    expectedReadback: 'Looking for traffic, November-One-Two-Three-Alpha-Bravo.',
  },
  {
    title: 'Airport Diversion (Emergency)',
    description: 'Simulate an emergency by responding to an unexpected airport closure and diversion.',
    category: 'Emergency Procedures',
    atcInstruction: 'Mayday, Mayday, Mayday, all aircraft, Boston airport is closed. November-One-Two-Three-Alpha-Bravo, your new destination is Providence. Turn left heading one-eight-zero, vectors to Providence, descend and maintain five thousand.',
    expectedReadback: 'Left heading one-eight-zero, descend and maintain five thousand, proceeding direct Providence, November-One-Two-Three-Alpha-Bravo.',
  }
];