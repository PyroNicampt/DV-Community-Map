'use strict';
import * as Vector from './vectorlib.js';
/** A 3D vector
 * @typedef {Object} Vector
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/** Estimate the maximum grade of the bezier.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} iterationCount - How many steps along the bezier to check
 * @returns {number} Grade as a decimal
 */
export function estimateMaxGrade(p1, h1, h2, p2, iterationCount = 50){
    let grade = 0;
    let totalGrade = 0;
    for(let i=0; i<=iterationCount; i++){
        let tan = evaluateVelocity(p1, h1, h2, p2, i/iterationCount);
        let newGrade = Math.abs(tan.y)/Math.sqrt(tan.x*tan.x + tan.z*tan.z);
        grade = Math.max(grade, newGrade);
        totalGrade += newGrade;
    }
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

/** Estimate the maximum 3D curvature of the bezier.
 * @param {Vector} p1 - Start
 * @param {Vector} h1 - Handle 1
 * @param {Vector} h2 - Handle 2
 * @param {Vector} p2 - End
 * @param {number} iterationCount - How many steps along the bezier to check
 * @returns {number} Curvature, take `1/curvature` to get radius.
 */
export function estimateMaxCurvature(p1, h1, h2, p2, iterationCount = 50){
    let curvature = 0;
    let t = 0;
    let vel = {};
    for(let i=0; i<iterationCount; i++){
        t = i/iterationCount;
        vel = evaluateVelocity(p1, h1, h2, p2, t);
        curvature = Math.max(curvature,
            Vector.length(Vector.cross(vel, evaluateAcceleration(p1, h1, h2, p2, t)))
            /Math.pow(Vector.length(vel),3));
    }
    return curvature;
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