'use strict';

import * as MapData from './mapdata.js';
import * as Pathfinder from './pathfinder.js';
import * as Config from './../config.js';

const state = {
    graph: null,
    points: [],
    route: null,
    addMode: false,
    draggingIndex: null,
    draggingPointerId: null,
    dragQueued: false,
    ui: {},
    options: {
        maxSpeed: Config.routing.maxSpeed,
        maxGrade: Config.routing.maxGrade,
        gradePenalty: Config.routing.gradePenalty,
    },
};

const markerColors = {
    start: '#35c45a',
    via: '#3b82f6',
    end: '#ef4444',
};

function mapPositionFromEvent(e){
    return {
        x: MapData.view.unconvertX(e.clientX),
        y: 0,
        z: MapData.view.unconvertY(e.clientY),
    };
}

function snapPosition(position){
    if(!state.graph) return position;
    const snap = Pathfinder.snapToNetwork(state.graph, position, state.options);
    if(!snap) return position;
    return snap.point;
}

function setPointAt(index, position){
    state.points[index] = {
        position: snapPosition(position),
    };
}

function addPoint(position, insertBeforeEnd = false){
    const snapped = snapPosition(position);
    if(insertBeforeEnd && state.points.length >= 2){
        state.points.splice(state.points.length - 1, 0, {position: snapped});
    }else{
        state.points.push({position: snapped});
    }
}

function clearPoints(){
    state.points = [];
    state.route = null;
    renderStops();
    renderSummary('Click the map to set a start point.');
    MapData.view.dynDirty = true;
}

function stopLabel(index){
    return String.fromCharCode(65 + index);
}

function stopRole(index){
    if(index === 0) return 'Start';
    if(index === state.points.length - 1) return 'End';
    return 'Stop';
}

function stopColor(index){
    if(index === 0) return markerColors.start;
    if(index === state.points.length - 1) return markerColors.end;
    return markerColors.via;
}

function formatPosition(pos){
    return `X ${pos.x.toFixed(1)}, Z ${pos.z.toFixed(1)}`;
}

function renderStops(){
    const list = state.ui.stops;
    if(!list) return;
    list.innerHTML = '';

    const total = Math.max(state.points.length, 2);
    for(let i=0; i<total; i++){
        const row = document.createElement('div');
        row.className = 'directionRow';

        const badge = document.createElement('div');
        badge.className = 'directionBadge';
        badge.style.background = (i === 0) ? markerColors.start : (i === total - 1 ? markerColors.end : markerColors.via);
        badge.textContent = stopLabel(i);
        row.appendChild(badge);

        const input = document.createElement('input');
        input.className = 'directionInput';
        input.readOnly = true;
        if(state.points[i]){
            input.value = formatPosition(state.points[i].position);
        }else{
            input.placeholder = i === 0 ? 'Click map to set start' : 'Click map to set end';
        }
        row.appendChild(input);

        if(i > 0 && i < total - 1 && state.points[i]){
            const remove = document.createElement('button');
            remove.className = 'directionButton';
            remove.textContent = 'Remove';
            remove.addEventListener('click', () => {
                state.points.splice(i, 1);
                scheduleRouteUpdate();
                renderStops();
            });
            row.appendChild(remove);
        }

        list.appendChild(row);
    }

    state.ui.addStop.disabled = state.points.length < 2;
}

function renderSummary(text){
    if(!state.ui.summary) return;
    state.ui.summary.textContent = text;
}

function formatDuration(seconds){
    if(!Number.isFinite(seconds)) return '-';
    const mins = Math.round(seconds / 60);
    if(mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours} h ${rem} m`;
}

function updateRoute(){
    if(!state.graph || state.points.length < 2){
        state.route = null;
        renderSummary('Click the map to set a start and end point.');
        MapData.view.dynDirty = true;
        return;
    }

    let combinedPolyline = [];
    let combinedEdges = [];

    for(let i=0; i<state.points.length - 1; i++){
        const start = state.points[i].position;
        const end = state.points[i+1].position;
        const result = Pathfinder.findRoute(state.graph, start, end, state.options);
        if(!result){
            state.route = null;
            renderSummary('No route found with current limits.');
            MapData.view.dynDirty = true;
            return;
        }
        combinedEdges = combinedEdges.concat(result.edges);

        if(combinedPolyline.length > 0 && result.polyline.length > 0){
            const last = combinedPolyline[combinedPolyline.length - 1];
            const first = result.polyline[0];
            if(last.x === first.x && last.z === first.z){
                combinedPolyline = combinedPolyline.concat(result.polyline.slice(1));
            }else{
                combinedPolyline = combinedPolyline.concat(result.polyline);
            }
        }else{
            combinedPolyline = combinedPolyline.concat(result.polyline);
        }
    }

    const stats = Pathfinder.computeRouteStats(combinedEdges, state.options);
    state.route = {
        polyline: combinedPolyline,
        stats,
    };

    const distanceKm = (stats.length / 1000).toFixed(2);
    const duration = formatDuration(stats.time);
    state.ui.summary.innerHTML = [
        `Distance ${distanceKm} km`,
        `<span title="Estimated travel time with acceleration and braking between speed changes.">Est. ${duration}</span>`,
        `<span title="Steepest grade encountered along the route.">Max grade ${stats.maxGrade.toFixed(1)}%</span>`,
        `<span title="Highest effective speed used in estimation after applying limits, grade penalty, and curve caps.">Max speed ${Math.round(stats.maxSpeed)} km/h</span>`,
        `<span title="Highest posted track speed limit encountered (with realistic caps for unposted sections).">Max speed limit ${Math.round(stats.maxSpeedLimit)} km/h</span>`,
    ].join(' | ');
    MapData.view.dynDirty = true;
}

function scheduleRouteUpdate(){
    if(state.dragQueued) return;
    state.dragQueued = true;
    requestAnimationFrame(() => {
        state.dragQueued = false;
        updateRoute();
    });
}

function drawPolyline(ctx){
    if(!state.route || !state.route.polyline || state.route.polyline.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const width = 6 * MapData.view.pixelRatio;
    const outline = 10 * MapData.view.pixelRatio;

    ctx.beginPath();
    for(let i=0; i<state.route.polyline.length; i++){
        const p = state.route.polyline[i];
        const x = MapData.view.convertX(p.x);
        const y = MapData.view.convertY(p.z);
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#0b1220cc';
    ctx.lineWidth = outline;
    ctx.stroke();

    ctx.strokeStyle = '#4fa3ff';
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
}

function drawMarkers(ctx){
    const radius = Config.routing.markerRadius * MapData.view.pixelRatio;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${10 * MapData.view.pixelRatio}px "Noto Sans"`;
    for(let i=0; i<state.points.length; i++){
        const pos = state.points[i].position;
        const x = MapData.view.convertX(pos.x);
        const y = MapData.view.convertY(pos.z);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = stopColor(i);
        ctx.fill();
        ctx.strokeStyle = '#0b0f1a';
        ctx.lineWidth = 2 * MapData.view.pixelRatio;
        ctx.stroke();
        ctx.fillStyle = '#0b0f1a';
        ctx.fillText(stopLabel(i), x, y + 0.5 * MapData.view.pixelRatio);
    }
    ctx.restore();
}

function handleMapPointerUp(e){
    if(e.button !== 0) return;
    if(state.draggingIndex != null) return;
    const down = state.ui.lastPointerDown;
    if(!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    if(distance > 6) return;

    const position = mapPositionFromEvent(e);
    if(state.points.length === 0){
        addPoint(position);
    }else if(state.points.length === 1){
        addPoint(position);
    }else if(state.addMode){
        addPoint(position, true);
        state.addMode = false;
        state.ui.addStop.classList.remove('active');
    }else{
        return;
    }
    renderStops();
    scheduleRouteUpdate();
}

export function initialize(){
    state.graph = Pathfinder.buildGraph(MapData.railTracks);

    state.ui.panel = document.getElementById('directionsPanel');
    state.ui.contents = document.getElementById('directionsContents');
    state.ui.stops = document.getElementById('directionsStops');
    state.ui.summary = document.getElementById('directionsSummary');
    state.ui.addStop = document.getElementById('directionsAddStop');
    state.ui.clear = document.getElementById('directionsClear');
    state.ui.maxSpeed = document.getElementById('routeMaxSpeed');
    state.ui.maxGrade = document.getElementById('routeMaxGrade');
    state.ui.gradePenalty = document.getElementById('routeGradePenalty');
    state.ui.toggle = document.getElementById('directionsToggle');

    state.ui.maxSpeed.value = state.options.maxSpeed;
    state.ui.maxGrade.value = state.options.maxGrade;
    state.ui.gradePenalty.value = state.options.gradePenalty;

    state.ui.maxSpeed.addEventListener('change', e => {
        state.options.maxSpeed = Math.max(10, Number(e.target.value) || Config.routing.maxSpeed);
        scheduleRouteUpdate();
    });
    state.ui.maxGrade.addEventListener('change', e => {
        state.options.maxGrade = Math.max(0, Number(e.target.value) || Config.routing.maxGrade);
        scheduleRouteUpdate();
    });
    state.ui.gradePenalty.addEventListener('input', e => {
        state.options.gradePenalty = Math.max(0, Number(e.target.value) || 0);
        scheduleRouteUpdate();
    });

    state.ui.addStop.addEventListener('click', () => {
        if(state.points.length < 2) return;
        state.addMode = !state.addMode;
        state.ui.addStop.classList.toggle('active', state.addMode);
    });

    state.ui.clear.addEventListener('click', () => {
        state.addMode = false;
        state.ui.addStop.classList.remove('active');
        clearPoints();
    });

    const updatePanelState = () => {
        const width = state.ui.contents.offsetWidth;
        if(state.ui.panel.classList.contains('collapsed')){
            state.ui.panel.style.transform = `translateX(${-width}px)`;
            state.ui.toggle.textContent = '>';
        }else{
            state.ui.panel.style.transform = 'translateX(0px)';
            state.ui.toggle.textContent = '<';
        }
    };

    state.ui.toggle.addEventListener('click', () => {
        state.ui.panel.classList.toggle('collapsed');
        updatePanelState();
    });

    window.addEventListener('resize', updatePanelState);

    const mapContainer = document.getElementById('mapContainer');
    mapContainer.addEventListener('pointerdown', e => {
        state.ui.lastPointerDown = {x:e.clientX, y:e.clientY};
    });
    mapContainer.addEventListener('pointerup', handleMapPointerUp);

    renderStops();
    renderSummary('Click the map to set a start point.');
    updatePanelState();
}

export function draw(ctx){
    drawPolyline(ctx);
    drawMarkers(ctx);
}

function hitTestMarker(e){
    if(state.points.length === 0) return null;
    const radius = (Config.routing.markerRadius + 6) * MapData.view.pixelRatio;
    const x = e.clientX * MapData.view.pixelRatio;
    const y = e.clientY * MapData.view.pixelRatio;
    for(let i=0; i<state.points.length; i++){
        const pos = state.points[i].position;
        const sx = MapData.view.convertX(pos.x);
        const sy = MapData.view.convertY(pos.z);
        const dx = sx - x;
        const dy = sy - y;
        if(dx*dx + dy*dy <= radius*radius) return i;
    }
    return null;
}

export function handlePointerDown(e){
    if(e.button !== 0) return false;
    const hit = hitTestMarker(e);
    if(hit == null) return false;
    state.draggingIndex = hit;
    state.draggingPointerId = e.pointerId;
    return true;
}

export function handlePointerMove(e){
    if(state.draggingIndex == null) return false;
    if(state.draggingPointerId !== e.pointerId) return false;
    const position = mapPositionFromEvent(e);
    setPointAt(state.draggingIndex, position);
    scheduleRouteUpdate();
    return true;
}

export function handlePointerUp(e){
    if(state.draggingIndex == null) return false;
    if(state.draggingPointerId !== e.pointerId) return false;
    state.draggingIndex = null;
    state.draggingPointerId = null;
    scheduleRouteUpdate();
    return true;
}
