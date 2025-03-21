'use strict';

import * as Config from './../config.js';
import {SpriteBounds} from './spritelib.js';

export const gradeIncrements = [
    0.0498,
    0.04,
    0.035,
    0.03,
    0.025,
    0.02,
    0.015,
    0.01,
    0.005,
    0.001
];

const gradeArrowDimensions = 64 * window.devicePixelRatio;
export const gradeArrows = new OffscreenCanvas(11*gradeArrowDimensions, 2*gradeArrowDimensions);

export function generateGradeArrows(){
    const ctx = gradeArrows.getContext('2d');
    const mapSprites = document.getElementById('mapSprites');
    for(let i=0; i<11; i++){
        ctx.drawImage(
            mapSprites,
            Config.spriteBounds.gradeArrow.x,
            Config.spriteBounds.gradeArrow.y,
            Config.spriteBounds.gradeArrow.width,
            Config.spriteBounds.gradeArrow.height,
            i*gradeArrowDimensions,
            0,
            gradeArrowDimensions,
            gradeArrowDimensions
        );
        ctx.drawImage(
            mapSprites,
            Config.spriteBounds.gradeArrowDown.x,
            Config.spriteBounds.gradeArrowDown.y,
            Config.spriteBounds.gradeArrowDown.width,
            Config.spriteBounds.gradeArrowDown.height,
            i*gradeArrowDimensions,
            gradeArrowDimensions,
            gradeArrowDimensions,
            gradeArrowDimensions
        );

        if(i == 0){
            Config.spriteBounds['gradeArrow_flat'] = new SpriteBounds(0, 0, gradeArrowDimensions, gradeArrowDimensions);
            Config.spriteBounds['gradeArrowDown_flat'] = new SpriteBounds(0, gradeArrowDimensions, gradeArrowDimensions, gradeArrowDimensions);
        }else{
            Config.spriteBounds['gradeArrow_'+(i-1)] = new SpriteBounds(i*gradeArrowDimensions, 0, gradeArrowDimensions, gradeArrowDimensions);
            Config.spriteBounds['gradeArrowDown_'+(i-1)] = new SpriteBounds(i*gradeArrowDimensions, gradeArrowDimensions, gradeArrowDimensions, gradeArrowDimensions);
        }
    }
    let arrowLayer = gradeArrows.transferToImageBitmap();
    for(let i=0; i<11; i++){
        if(i == 0)
            ctx.fillStyle = Config.gradeColors.grade_flat;
        else
            ctx.fillStyle = Config.gradeColors['grade_'+(i-1)];
        ctx.fillRect(i*gradeArrowDimensions, 0, gradeArrowDimensions, gradeArrowDimensions * 2);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(arrowLayer, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(arrowLayer, 0, 0);
    arrowLayer.close();
}

export function randomRange(min=0.0, max=1.0){
    return Math.random()*(max-min) + min;
}

export function gradeToClass(grade){
    for(let j=0; j<gradeIncrements.length; j++){
        if(grade > gradeIncrements[j]){
            return gradeIncrements.length-(j+1);
        }
    }
    return 'flat';
}

export function classToGrade(className){
    let classNum = Math.min(Math.max(Number(className), 0), gradeIncrements.length-1);
    if(Number.isNaN(classNum)) return 0;
    return gradeIncrements[gradeIncrements.length-1-classNum];
}

/**
 * Outputs an easy to read time interval between `date1` and `date2`
 * @param {Date} date 
 */
export function formattedTimeBetweenDates(date1, date2){
    let interval = (date2 - date1)/1000;
    if(interval < 0) interval *= -1;
    let finalInterval = Math.floor(interval);
    if(interval < 60) return finalInterval+(finalInterval == 1 ? ' second' : ' seconds');
    interval /= 60;
    finalInterval = Math.floor(interval);
    if(interval < 60) return finalInterval+(finalInterval == 1 ? ' minute' : ' minutes');
    interval /= 60;
    finalInterval = Math.floor(interval);
    if(interval < 24) return finalInterval+(finalInterval == 1 ? ' hour' : ' hours');
    interval /= 24;
    finalInterval = Math.floor(interval);
    if(interval < 7) return finalInterval+(finalInterval == 1 ? ' day' : ' days');
    finalInterval = Math.floor(interval/7);
    if(interval < 30.4375) return finalInterval+(finalInterval == 1 ? ' week' : ' weeks');
    finalInterval = Math.floor(interval/30.4375);
    if(interval < 365.25) return finalInterval+(finalInterval == 1 ? ' month' : ' months');
    finalInterval = Math.floor(interval/365.25);
    return finalInterval+(finalInterval == 1 ? ' year' : ' years');
}

export function radiusToSpeed(radius){
    if(radius < 50) return 10;
    else if(radius < 70) return 20;
    else if(radius < 95) return 30;
    else if(radius < 130) return 40;
    else if(radius < 170) return 50;
    else if(radius < 230) return 60;
    else if(radius < 360) return 70;
    else if(radius < 700) return 80;
    else if(radius < 900) return 90;
    else if(radius < 1200) return 100;
    return 120;
}

export function clamp(v, min = 0, max = 1){
    return Math.max(Math.min(v, max), min);
}

export function zoomToCullLevel(zoom){
    if(zoom < 1) return 0;
    if(zoom < 2) return 1;
    if(zoom < 3) return 2;
    if(zoom < 6) return 3;
    if(zoom < 12) return 4;
    if(zoom < 24) return 5;
    if(zoom < 60) return 6;
    return 7;
}

export function lerp(a, b, t){
    return (a * (1-t)) + (b*t);
}

export function mod(a, b){
    return (a % b + b) % b;
}

export function titleCase(text){
    text = text.toString();
    if(text){
        return `${text[0].toUpperCase()}${text.substring(1)}`;
    }
    return '';
}

const cardinalDirections = [
    'North',
    'Northeast',
    'East',
    'Southeast',
    'South',
    'Southwest',
    'West',
    'Northwest',
]
export function angleToCardinalDirection(angle){
    return cardinalDirections[Math.floor(mod(angle/(2*Math.PI) + (0.5/cardinalDirections.length), 1)*cardinalDirections.length)];
}