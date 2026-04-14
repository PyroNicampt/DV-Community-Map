'use strict';

import * as Bezier from './bezierlib.js';
import * as Utils from './utillib.js';
import * as Config from './../config.js';

const defaults = {
    maxSpeed: Config.routing.maxSpeed,
    maxGrade: Config.routing.maxGrade,
    gradePenalty: Config.routing.gradePenalty,
    minGradeFactor: Config.routing.minGradeFactor,
    snapSearchSteps: Config.routing.snapSearchSteps,
    polylineStepMeters: Config.routing.polylineStepMeters,
    maxSnapDistance: Config.routing.maxSnapDistance,
    assumedUnpostedSpeed: Config.routing.assumedUnpostedSpeed,
    unpostedSpeedLimit: Config.routing.unpostedSpeedLimit,
    tightCurveRadius: Config.routing.tightCurveRadius,
    tightCurveSpeed: Config.routing.tightCurveSpeed,
    accel: Config.routing.accel,
    decel: Config.routing.decel,
};

function distance2D(a, b){
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx*dx + dz*dz);
}

function distance3D(a, b){
    const dx = a.x - b.x;
    const dy = (a.y ?? 0) - (b.y ?? 0);
    const dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function boundsDistance2D(bounds, point){
    let dx = 0;
    let dz = 0;
    if(point.x < bounds.min.x) dx = bounds.min.x - point.x;
    else if(point.x > bounds.max.x) dx = point.x - bounds.max.x;
    if(point.z < bounds.min.z) dz = bounds.min.z - point.z;
    else if(point.z > bounds.max.z) dz = point.z - bounds.max.z;
    return Math.sqrt(dx*dx + dz*dz);
}

function approximateCurveLength(curve, t0, t1, steps){
    if(t0 === t1) return 0;
    const start = Math.min(t0, t1);
    const end = Math.max(t0, t1);
    const segments = Math.max(2, steps ?? 16);
    let length = 0;
    let prev = Bezier.evaluatePoint(curve.start, curve.h1, curve.h2, curve.end, start);
    for(let i=1; i<=segments; i++){
        const t = Utils.lerp(start, end, i/segments);
        const cur = Bezier.evaluatePoint(curve.start, curve.h1, curve.h2, curve.end, t);
        length += distance3D(prev, cur);
        prev = cur;
    }
    return length;
}

export function buildGraph(railTracks, precision = 2){
    const nodes = [];
    const edges = [];
    const curves = [];
    const nodeIndex = new Map();

    const keyFor = pos => `${pos.x.toFixed(precision)}|${pos.y.toFixed(precision)}|${pos.z.toFixed(precision)}`;

    const getNodeId = pos => {
        const key = keyFor(pos);
        let id = nodeIndex.get(key);
        if(id == null){
            id = nodes.length;
            nodeIndex.set(key, id);
            nodes.push({
                id,
                position: {x:pos.x, y:pos.y, z:pos.z},
            });
            edges[id] = [];
        }
        return id;
    };

    const addEdge = (from, to, edge) => {
        edges[from].push(edge);
    };

    for(const railTrack of railTracks){
        for(const curve of railTrack.curves){
            const startId = getNodeId(curve.start);
            const endId = getNodeId(curve.end);
            curve._routeStartId = startId;
            curve._routeEndId = endId;
            curve._routeTrackName = railTrack.name;
            const edgeBase = {
                curve,
                length: curve.length,
                grade: curve.grade,
                speed: curve.postedSpeed,
            };
            addEdge(startId, endId, {
                ...edgeBase,
                to: endId,
                t0: 0,
                t1: 1,
            });
            addEdge(endId, startId, {
                ...edgeBase,
                to: startId,
                t0: 1,
                t1: 0,
            });
            curves.push(curve);
        }
    }

    return {nodes, edges, curves};
}

export function snapToNetwork(graph, position, options = {}){
    const opts = {...defaults, ...options};
    let best = null;
    let bestDist = Infinity;
    let bestT = 0;
    let bestPoint = null;
    for(const curve of graph.curves){
        const boundDist = boundsDistance2D(curve.bounds, position);
        if(boundDist > bestDist) continue;
        const steps = opts.snapSearchSteps;
        let localBestDist = Infinity;
        let localBestT = 0;
        let localBestPoint = null;
        for(let i=0; i<=steps; i++){
            const t = i/steps;
            const p = Bezier.evaluatePoint(curve.start, curve.h1, curve.h2, curve.end, t);
            const d = distance2D(p, position);
            if(d < localBestDist){
                localBestDist = d;
                localBestT = t;
                localBestPoint = p;
            }
        }
        if(localBestDist < bestDist){
            bestDist = localBestDist;
            bestT = localBestT;
            bestPoint = localBestPoint;
            best = curve;
        }
    }
    if(best == null) return null;
    return {
        curve: best,
        t: bestT,
        point: {x:bestPoint.x, y:bestPoint.y, z:bestPoint.z},
        distance: bestDist,
    };
}

class MinHeap{
    constructor(){
        this.data = [];
    }
    push(item){
        this.data.push(item);
        this.bubbleUp(this.data.length - 1);
    }
    pop(){
        if(this.data.length === 0) return null;
        const root = this.data[0];
        const last = this.data.pop();
        if(this.data.length > 0){
            this.data[0] = last;
            this.bubbleDown(0);
        }
        return root;
    }
    bubbleUp(index){
        while(index > 0){
            const parent = Math.floor((index - 1) / 2);
            if(this.data[parent].priority <= this.data[index].priority) break;
            [this.data[parent], this.data[index]] = [this.data[index], this.data[parent]];
            index = parent;
        }
    }
    bubbleDown(index){
        const length = this.data.length;
        while(true){
            let left = index * 2 + 1;
            let right = left + 1;
            let smallest = index;
            if(left < length && this.data[left].priority < this.data[smallest].priority) smallest = left;
            if(right < length && this.data[right].priority < this.data[smallest].priority) smallest = right;
            if(smallest === index) break;
            [this.data[smallest], this.data[index]] = [this.data[index], this.data[smallest]];
            index = smallest;
        }
    }
    get size(){
        return this.data.length;
    }
}

function effectivePostedSpeed(edge, options){
    let speed = edge.speed;
    if(options.assumedUnpostedSpeed != null && speed >= options.assumedUnpostedSpeed){
        speed = Math.min(speed, options.unpostedSpeedLimit);
    }
    if(edge.curve && edge.curve.curvature && options.tightCurveRadius != null){
        const radius = 1 / edge.curve.curvature;
        if(Number.isFinite(radius) && radius < options.tightCurveRadius){
            speed = Math.min(speed, options.tightCurveSpeed);
        }
    }
    return speed;
}

function effectiveSpeedUsed(edge, options){
    let speed = effectivePostedSpeed(edge, options);
    speed = Math.min(speed, options.maxSpeed ?? speed);
    if(speed <= 0) return 0;
    const gradePct = Math.abs(edge.grade) * 100;
    if(options.maxGrade != null && gradePct > options.maxGrade) return 0;
    const gradeFactor = Math.max(options.minGradeFactor, 1 - options.gradePenalty * gradePct);
    return speed * gradeFactor;
}

function edgeCost(edge, options){
    const speedKmh = effectiveSpeedUsed(edge, options);
    if(speedKmh <= 0.01) return Infinity;
    const speedMps = speedKmh * 1000 / 3600;
    return edge.length / speedMps;
}

function segmentTravelTime(length, v0, v1, vMax, accel, decel){
    if(vMax <= 0.01) return Infinity;
    const a = Math.max(accel, 0.01);
    const d = Math.max(decel, 0.01);
    v0 = Math.min(v0, vMax);
    v1 = Math.min(v1, vMax);
    const accelDist = Math.max(0, (vMax*vMax - v0*v0) / (2 * a));
    const decelDist = Math.max(0, (vMax*vMax - v1*v1) / (2 * d));
    if(accelDist + decelDist <= length){
        const cruise = length - accelDist - decelDist;
        return (vMax - v0)/a + (vMax - v1)/d + cruise / vMax;
    }
    const numerator = 2 * length + (v0*v0)/a + (v1*v1)/d;
    const denom = (1/a + 1/d);
    const vPeak = Math.sqrt(Math.max(numerator / denom, 0));
    return Math.max(0, (vPeak - v0)/a) + Math.max(0, (vPeak - v1)/d);
}

function estimateRouteTime(edges, speedLimits, options){
    if(edges.length === 0) return 0;
    const speeds = speedLimits.map(limit => Math.max(0, limit) * 1000 / 3600);
    const boundaries = new Array(edges.length + 1);
    boundaries[0] = 0;
    boundaries[edges.length] = 0;
    for(let i=1; i<edges.length; i++){
        boundaries[i] = Math.min(speeds[i-1], speeds[i]);
    }
    let time = 0;
    for(let i=0; i<edges.length; i++){
        time += segmentTravelTime(
            edges[i].length,
            boundaries[i],
            boundaries[i+1],
            speeds[i],
            options.accel,
            options.decel
        );
    }
    return time;
}

export function computeRouteStats(edges, options = {}){
    const opts = {...defaults, ...options};
    let totalLength = 0;
    let maxGrade = 0;
    let maxSpeedLimit = 0;
    let maxSpeed = 0;
    const usedLimits = [];
    for(const edge of edges){
        totalLength += edge.length;
        maxGrade = Math.max(maxGrade, Math.abs(edge.grade) * 100);
        const posted = effectivePostedSpeed(edge, opts);
        const used = effectiveSpeedUsed(edge, opts);
        maxSpeedLimit = Math.max(maxSpeedLimit, posted);
        maxSpeed = Math.max(maxSpeed, used);
        usedLimits.push(used);
    }
    const time = estimateRouteTime(edges, usedLimits, opts);
    return {
        length: totalLength,
        time,
        maxGrade,
        maxSpeed,
        maxSpeedLimit,
    };
}

function buildPolyline(edges, options){
    const points = [];
    const stepMeters = options.polylineStepMeters;
    for(const edge of edges){
        const curve = edge.curve;
        if(!curve) continue;
        const steps = Math.max(2, Math.ceil(edge.length / stepMeters));
        for(let i=0; i<=steps; i++){
            const t = Utils.lerp(edge.t0, edge.t1, i/steps);
            const p = Bezier.evaluatePoint(curve.start, curve.h1, curve.h2, curve.end, t);
            const last = points[points.length - 1];
            if(!last || last.x !== p.x || last.z !== p.z){
                points.push({x:p.x, z:p.z});
            }
        }
    }
    return points;
}

export function findRoute(graph, startPos, endPos, options = {}){
    const opts = {...defaults, ...options};
    const startSnap = snapToNetwork(graph, startPos, opts);
    const endSnap = snapToNetwork(graph, endPos, opts);
    if(!startSnap || !endSnap) return null;
    if(opts.maxSnapDistance != null){
        if(startSnap.distance > opts.maxSnapDistance || endSnap.distance > opts.maxSnapDistance) return null;
    }

    const baseCount = graph.nodes.length;
    const startId = baseCount;
    const endId = baseCount + 1;
    const tempPositions = [];
    tempPositions[startId] = startSnap.point;
    tempPositions[endId] = endSnap.point;

    const extraEdges = [];
    const addTempEdge = (from, to, edge) => {
        if(!extraEdges[from]) extraEdges[from] = [];
        extraEdges[from].push(edge);
    };

    const connectSnap = (snap, nodeId) => {
        const curve = snap.curve;
        const startNode = curve._routeStartId;
        const endNode = curve._routeEndId;
        const t = snap.t;
        const steps = Math.max(6, Math.ceil(curve.length / 80));
        const lenToStart = approximateCurveLength(curve, 0, t, steps);
        const lenToEnd = approximateCurveLength(curve, t, 1, steps);
        const edgeBase = {
            curve,
            grade: curve.grade,
            speed: curve.postedSpeed,
        };
        addTempEdge(nodeId, startNode, {
            ...edgeBase,
            to: startNode,
            length: lenToStart,
            t0: t,
            t1: 0,
        });
        addTempEdge(nodeId, endNode, {
            ...edgeBase,
            to: endNode,
            length: lenToEnd,
            t0: t,
            t1: 1,
        });
        addTempEdge(startNode, nodeId, {
            ...edgeBase,
            to: nodeId,
            length: lenToStart,
            t0: 0,
            t1: t,
        });
        addTempEdge(endNode, nodeId, {
            ...edgeBase,
            to: nodeId,
            length: lenToEnd,
            t0: 1,
            t1: t,
        });
    };

    connectSnap(startSnap, startId);
    connectSnap(endSnap, endId);

    if(startSnap.curve === endSnap.curve){
        const curve = startSnap.curve;
        const steps = Math.max(6, Math.ceil(curve.length / 80));
        const lenBetween = approximateCurveLength(curve, startSnap.t, endSnap.t, steps);
        const edgeBase = {
            curve,
            grade: curve.grade,
            speed: curve.postedSpeed,
        };
        addTempEdge(startId, endId, {
            ...edgeBase,
            to: endId,
            length: lenBetween,
            t0: startSnap.t,
            t1: endSnap.t,
        });
        addTempEdge(endId, startId, {
            ...edgeBase,
            to: startId,
            length: lenBetween,
            t0: endSnap.t,
            t1: startSnap.t,
        });
    }

    const totalNodes = baseCount + 2;
    const dist = new Array(totalNodes).fill(Infinity);
    const prev = new Array(totalNodes).fill(-1);
    const prevEdge = new Array(totalNodes).fill(null);
    const visited = new Array(totalNodes).fill(false);
    const heap = new MinHeap();

    const nodePosition = id => {
        if(id < baseCount) return graph.nodes[id].position;
        return tempPositions[id];
    };

    const maxSpeedMps = (opts.maxSpeed * 1000 / 3600);
    const heuristic = id => {
        const pos = nodePosition(id);
        const target = tempPositions[endId];
        return distance2D(pos, target) / Math.max(maxSpeedMps, 0.1);
    };

    dist[startId] = 0;
    heap.push({id:startId, priority:heuristic(startId)});

    const getNeighbors = id => {
        const baseEdges = id < baseCount ? graph.edges[id] : [];
        const extra = extraEdges[id] ?? [];
        return baseEdges.concat(extra);
    };

    while(heap.size){
        const current = heap.pop();
        if(!current) break;
        const id = current.id;
        if(visited[id]) continue;
        visited[id] = true;
        if(id === endId) break;
        for(const edge of getNeighbors(id)){
            const cost = edgeCost(edge, opts);
            if(cost === Infinity) continue;
            const next = edge.to;
            const alt = dist[id] + cost;
            if(alt < dist[next]){
                dist[next] = alt;
                prev[next] = id;
                prevEdge[next] = edge;
                heap.push({id:next, priority:alt + heuristic(next)});
            }
        }
    }

    if(!Number.isFinite(dist[endId])) return null;

    const pathEdges = [];
    let cur = endId;
    while(cur !== startId && cur !== -1){
        const edge = prevEdge[cur];
        if(!edge) break;
        pathEdges.push(edge);
        cur = prev[cur];
    }
    pathEdges.reverse();

    return {
        edges: pathEdges,
        polyline: buildPolyline(pathEdges, opts),
        stats: computeRouteStats(pathEdges, opts),
        snaps: {
            start: startSnap,
            end: endSnap,
        }
    };
}
