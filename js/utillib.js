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

export function rgba2hex(r,g,b,a=1.0){
    r = Math.min(Math.max(r,0),1);
    g = Math.min(Math.max(g,0),1);
    b = Math.min(Math.max(b,0),1);
    a = Math.min(Math.max(a,0),1);
    return `#${
        Math.round(r*255).toString(16).padStart(2, '0').substring(0,2)
    }${
        Math.round(g*255).toString(16).padStart(2, '0').substring(0,2)
    }${
        Math.round(b*255).toString(16).padStart(2, '0').substring(0,2)
    }${
        Math.round(a*255).toString(16).padStart(2, '0').substring(0,2)
    }`;
}

export function gradeToClass(grade){
    for(let j=0; j<gradeIncrements.length; j++){
        if(grade > gradeIncrements[j]){
            return gradeIncrements.length-(j+1);
        }
    }
    return 'flat';
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