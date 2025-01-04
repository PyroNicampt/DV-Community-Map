'use strict';

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
]

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