'use strict';
import * as Vector from './vectorlib.js';
import * as Utils from './utillib.js';
/** A 3D vector
 * @typedef {Object} Vector
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/** Estimate the grade of the bezier.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} iterationCount - How many steps along the bezier to check
 * @returns {number} Grade as a decimal
 */
export function estimateGrade(p1, h1, h2, p2, iterationCount = 50){
    let grade = 0;
    let totalGrade = 0;
    for(let i=0; i<=iterationCount; i++){
        let tan = evaluateVelocity(p1, h1, h2, p2, i/iterationCount);
        let newGrade = Math.abs(tan.y)/Math.sqrt(tan.x*tan.x + tan.z*tan.z);
        if(!Number.isNaN(newGrade)){
            grade = Math.max(grade, newGrade);
            totalGrade += newGrade;
        }
    }
    if(!grade) return 0;
    return grade;
}

/** Estimate the length of the bezier.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} iterationCount - How many steps along the bezier to check
 * @returns {number} Length
 */
export function estimateLength(p1, h1, h2, p2, iterationCount = 50){
    let length = 0;
    let prevPos = p1;
    let curPos = {};
    for(let i=1; i<=iterationCount; i++){
        curPos = evaluatePoint(p1, h1, h2, p2, i/iterationCount);
        length += Vector.distance(prevPos, curPos);
        prevPos = curPos;
    }
    return length;
}

/** Estimate the 3D curvature of the bezier.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} iterationCount - How many steps along the bezier to check
 * @returns {number} Curvature, take `1/curvature` to get radius.
 */
export function estimateCurvature(p1, h1, h2, p2, iterationCount = 50){
    let curvature = 0;
    let t = 0;
    let vel = {};
    let totalCount = 0;
    for(let i=0; i<iterationCount; i++){
        t = i/iterationCount;
        vel = evaluateVelocity(p1, h1, h2, p2, t);
        let newCurvature = 
            Vector.length(Vector.cross(vel, evaluateAcceleration(p1, h1, h2, p2, t)))
            /Math.pow(Vector.length(vel),3);
        if(!Number.isNaN(newCurvature)){
            curvature += newCurvature;
            totalCount++;
        }
    }
    if(!curvature) return 0.00000001;
    return curvature/totalCount;
}

/** Evaluate the bezier at `t`, getting position.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} t - 0 to 1 of how far into the curve to check.
 * @returns {Vector}
 */
export function evaluatePoint(p1, h1, h2, p2, t){
    let result = {};
    let t3 = t*t*t;
    let t2 = t*t;
    let p1v = -t3 + 3*t2 - 3*t + 1;
    let h1v = 3*t3 - 6*t2 + 3*t;
    let h2v = -3*t3 + 3*t2;
    for(const axis of ['x', 'y', 'z']){
        result[axis] = p1[axis]*p1v + h1[axis]*h1v + h2[axis]*h2v + p2[axis]*t3;
    }
    return result;
}

/** Evaluate the bezier's first derivative at `t`, getting velocity.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} t - 0 to 1 of how far into the curve to check.
 * @returns {Vector}
 */
export function evaluateVelocity(p1, h1, h2, p2, t){
    let result = {};
    let t2 = t*t;
    let p1v = -3*t2 + 6*t -3;
    let h1v = 9*t2 - 12*t +3;
    let h2v = -9*t2 + 6*t;
    let p2v = 3*t2;
    for(const axis of ['x', 'y', 'z']){
        result[axis] = p1[axis]*p1v + h1[axis]*h1v + h2[axis]*h2v + p2[axis]*p2v;
    }
    return result;
}

/** Evaluate the bezier's second derivative at `t`, getting acceleration.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} t - 0 to 1 of how far into the curve to check.
 * @returns {Vector}
 */
export function evaluateAcceleration(p1, h1, h2, p2, t){
    let result = {};
    let p1v = -6*t + 6;
    let h1v = 18*t -12;
    let h2v = -18*t + 6;
    let p2v = 6*t;
    for(const axis of ['x', 'y', 'z']){
        result[axis] = p1[axis]*p1v + h1[axis]*h1v + h2[axis]*h2v + p2[axis]*p2v;
    }
    return result;
}

/** Get the min and max bounds of a bezier.
 * @param {Vector} p1 
 * @param {Vector} h1 
 * @param {Vector} h2 
 * @param {Vector} p2 
 */
export function getBounds(p1, h1, h2, p2){
    // TODO: replace this with a not brute-forced version.
    let pos;
    let min = {x:Infinity, y:Infinity, z:Infinity};
    let max = {x:-Infinity, y:-Infinity, z:-Infinity};
    for(let i=0; i<=40; i++){
        pos = evaluatePoint(p1, h1, h2, p2, i/40);
        min.x = Math.min(pos.x, min.x);
        max.x = Math.max(pos.x, max.x);
        min.y = Math.min(pos.y, min.y);
        max.y = Math.max(pos.y, max.y);
        min.z = Math.min(pos.z, min.z);
        max.z = Math.max(pos.z, max.z);
    }
    return {min:min, max:max};
}

/** Get the closest point on the curve to `testPoint` in 2D space, as well as the distance.
 * (This means using the (x,z) coordinates of the bezier as (x,y))
 * @param {Vector} p1 
 * @param {Vector} h1 
 * @param {Vector} h2 
 * @param {Vector} p2 
 * @param {*} testPoint 
 */
export function getNearestPoint2D(p1, h1, h2, p2, testPoint, iterationCount = 200){
    // TODO: replace this with a more accurate version
    let minDistance = Infinity;
    let bezEval;
    let evalDist;
    let closestPoint = {x:0, y:0};
    for(let i=0; i<=iterationCount; i++){
        bezEval = evaluatePoint(p1, h1, h2, p2, i/iterationCount);
        evalDist = Math.pow(testPoint.x-bezEval.x, 2) + Math.pow(testPoint.y-bezEval.z, 2);
        if(evalDist < minDistance){
            minDistance = evalDist;
            closestPoint.x = bezEval.x;
            closestPoint.y = bezEval.y;
        }
    }
    return {point:closestPoint, distance:Math.sqrt(minDistance)};
}