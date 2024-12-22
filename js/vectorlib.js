'use strict';

/** A 3D vector
 * @typedef {Object} Vector
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/** Get Euclidean Distance between v1 and v2.
 * @param {Vector} v1
 * @param {Vector} v2
 * @returns {number}
*/
export function distance(v1, v2){
    return Math.sqrt(Math.pow(v1.x-v2.x, 2)+Math.pow(v1.y-v2.y, 2)+Math.pow(v1.z-v2.z, 2));
}

/** Get Manhattan Distance between v1 and v2.
 * @param {Vector} v1
 * @param {Vector} v2
 * @returns {number}
*/
export function manhattanDistance(v1, v2){
    return Math.abs(v1.x-v2.x) + Math.abs(v1.y-v2.y) + Math.abs(v1.z-v2.z);
}

/** Get Distance between v1 and v2 with decreasing accuracy over distance.
 * @param {Vector} v1
 * @param {Vector} v2
 * @returns {number}
*/
export function roughDistance(v1, v2, farThreshold = 1600){
    const halfFar = farThreshold/2;
    let subvec = absSubtract(v1, v2);
    if(subvec.x > farThreshold) return subvec.x;
    else if(subvec.y > farThreshold) return subvec.y;
    else if(subvec.z > farThreshold) return subvec.z;
    else if(subvec.x > halfFar || subvec.y > halfFar || subvec.z > halfFar) return subvec.x+subvec.y+subvec.z;
    return distance(v1, v2);
}

/** Get length of a vector.
 * @param {Vector} v1
 * @returns {number}
*/
export function length(v1){
    return Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
}

/** Return the same vector with a length of 1.
 * @param {Vector} v1
 * @returns {Vector}
*/
export function normalize(v1){
    const len = length(v1);
    if(len === 0) return v1;
    return {x:v1.x/len, y:v1.y/len, z:v1.z/len};
}

/** Get the cross-product of v1 and v2
 * @param {Vector} v1
 * @param {Vector} v2
 * @param {boolean} normalize - normalize the input vectors
 * @returns {Vector}
 */
export function cross(v1, v2, normalize = false){
    if(normalize){
        v1 = normalize(v1);
        v2 = normalize(v2);
    }
    return {
        x: v1.y*v2.z - v1.z*v2.y,
        y: v1.z*v2.x - v1.x*v2.z,
        z: v1.x*v2.y - v1.y*v2.x
    };
}

/** Get the dot-product of v1 and v2
 * @param {Vector} v1
 * @param {Vector} v2
 * @param {boolean} normalize - normalize the input vectors
 * @returns {number}
 */
export function dot(v1, v2, normalize = false){
    let len = 1;
    if(normalize) len = 1/(length(v1) * length(v2));
    return v1.x*v2.x*len + v1.y*v2.y*len + v1.z*v2.z*len;
}

/** Are v1 and v2 within range of each other.
 * @param {Vector} v1
 * @param {Vector} v2
 * @param {number} range
 * @returns {boolean}
 */
export function isWithinAARange(v1, v2, range){
    return !(Math.abs(v2.x-v1.x) > range || Math.abs(v2.y-v1.y) > range || Math.abs(v2.z-v1.z) > range);
}

export function subtract(v1, v2){
    return {x:v1.x-v2.x, y:v1.y-v2.y, z:v1.y-v2.y};
}

export function absSubtract(v1, v2){
    return {x:Math.abs(v1.x-v2.x), y:Math.abs(v1.y-v2.y), z:Math.abs(v1.y-v2.y)};
}

class vector {
    constructor(x,y,z){
        this.x = x;
        this.y = y;
        this.z = z;
    }
}