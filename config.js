'use strict';
import {Color} from './js/colorlib.js';
import {SpriteBounds} from './js/spritelib.js';

export const gradeColors = {
    grade_flat: '#fff',
    grade_0: '#f4f7cd',
    grade_1: '#f8ff99',
    grade_2: '#edfc1b',
    grade_3: '#fcb520',
    grade_4: '#f07837',
    grade_5: '#e66441',
    grade_6: '#ce3f57',
    grade_7: '#c33577',
    grade_8: '#a3008d',
    grade_9: '#690097',
}

export const speedGradient = [
    new Color('#370065'),
    new Color('#79146e'),
    new Color('#d53354'),
    new Color('#fa8256'),
    new Color('#fbffb2'),
]

export const altitudeGradient = [
    new Color('#340042'),
    new Color('#235f7b'),
    new Color('#51c34e'),
    new Color('#fce51e'),
]

export const sidingUsageMeanings = {
    I:'Inbound',
    O:'Outbound',
    L:'Loading',
    P:'Locomotive Parking',
    S:'Car Storage',
    LP:'Passenger Transfer',
    SP:'Passenger Car Storage',
    D:'Service & Repair',
}

export const bezierGradeResolution = 80;
export const bezierLengthResolution = 80;
export const bezierCurvatureResolution = 80;
export const scrollZoomFactor = 1.25;
export const buttonZoomFactor = 1.5;

export const minZoomLevel = 0.01;
export const maxZoomLevel = 60;
export const defaultMapPadding = 500;

export const maxZoneLength = 700;

/** How many pixels around the view is still considered "visible", beyond this and items are culled. */
export const viewCullMargin = 60;

export const tooltipHitzone = {
    default: {radius:12},
    junction: {width:24, height:35},
};

export const spriteBounds = {
    unknown: new SpriteBounds(0,0,20,20),
    junction: new SpriteBounds(0,20,20,20),
    gradeArrow: new SpriteBounds(20,20,20,20),
    gradeArrowDown: new SpriteBounds(40,20,20,20),
    speed_1: new SpriteBounds(20,40,20,20),
    speed_2: new SpriteBounds(40,40,20,20),
    speed_3: new SpriteBounds(60,40,20,20),
    speed_4: new SpriteBounds(20,60,20,20),
    speed_5: new SpriteBounds(40,60,20,20),
    speed_6: new SpriteBounds(60,60,20,20),
    speed_7: new SpriteBounds(80,60,20,20),
    speed_8: new SpriteBounds(100,60,20,20),
    speed_9: new SpriteBounds(120,60,20,20),
    speed_10: new SpriteBounds(140,60,20,20),
    speed_12: new SpriteBounds(160,60,20,20),
    office: new SpriteBounds(0,80,20,20),
    office_military: new SpriteBounds(20,80,20,20),
    office_museum: new SpriteBounds(40,80,20,20),
    water: new SpriteBounds(0,100,20,20),
    coal: new SpriteBounds(20,100,20,20),
    landmark: new SpriteBounds(40,100,20,20),
    shop: new SpriteBounds(60,100,20,20),
    garage: new SpriteBounds(80,100,20,20),
    demonstrator: new SpriteBounds(100,100,20,20),
    service: new SpriteBounds(0,120,20,20),
    service_repair: new SpriteBounds(20,120,20,20),
    service_diesel: new SpriteBounds(40,120,20,20),
    service_charger: new SpriteBounds(60,120,20,20),
    player: new SpriteBounds(20,0,20,20),
}