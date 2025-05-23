'use strict';

import * as Utils from './js/utillib.js';
import * as Config from './config.js';
import { Color } from './js/colorlib.js';
import * as MapData from './js/mapdata.js';

let settingEntries = [
    {
        label: 'Color Mode',
        id: 'dropdown_trackColor',
        options: [
            'None',
            'Grade',
            'Altitude',
            'Speed',
            'Track Type',
            'Track Random',
            'Curve Random',
        ],
        state: 'Grade',
        func: state =>{
            MapData.setTrackColorMode(state);
        }
    },
    {
        label: 'Signage',
        id: 'toggle_signage',
        state: true,
        func: state =>{
            MapData.layers.signage = state;
            MapData.view.dirty = true;
        },
        children: [
            {
                label: 'Speed Signage',
                id: 'toggle_speedSigns',
                state: true,
                func: state =>{
                    MapData.layers.speedSigns = state;
                    MapData.view.dirty = true;
                },
            },
            {
                label: 'Grade Arrows',
                id: 'toggle_gradeSigns',
                state: true,
                func: state =>{
                    MapData.layers.gradeArrows = state;
                    MapData.view.dirty = true;
                },
            },
            {
                label: 'Yard Signage',
                id: 'toggle_yardSigns',
                state: true,
                func: state =>{
                    MapData.layers.yardSigns = state;
                    MapData.view.dirty = true;
                },
            },
            {
                label: 'Junctions',
                id: 'toggle_junctions',
                state: true,
                func: state =>{
                    MapData.layers.junctions = state;
                    MapData.view.dirty = true;
                },
            }
        ],
    },
    {
        label: 'Points of Interest',
        id: 'toggle_poi',
        state: true,
        func: state => {
            MapData.layers.poi = state;
            MapData.view.dirty = true;
        },
        children: [
            {
                label: 'Stations',
                id: 'toggle_stations',
                state: true,
                func: state =>{
                    MapData.layers.stations = state;
                    MapData.view.dirty = true;
                }
            },
            {
                label: 'Services',
                id: 'toggle_services',
                state: true,
                func: state =>{
                    MapData.layers.services = state;
                    MapData.view.dirty = true;
                },
            },
            {
                label: 'Landmarks',
                id: 'toggle_landmarks',
                state: true,
                func: state =>{
                    MapData.layers.landmarks = state;
                    MapData.view.dirty = true;
                },
            },
            {
                label: 'Demonstrator Spawns',
                id: 'dropdown_demonstrators',
                options: [
                    'None',
                    'Hint',
                    'Exact',
                ],
                state: 'None',
                func: state =>{
                    MapData.layers.demonstratorExact = state == 'Exact';
                    MapData.layers.demonstratorHint = state == 'Hint';
                    MapData.view.dirty = true;
                },
            }
        ]
    },
    {
        label: 'Grade Arrow Direction',
        id: 'dropdown_gradeArrowDirection',
        options: [
            'Uphill',
            'Downhill',
        ],
        state: 'Uphill',
        func: state =>{
            MapData.layers.gradeDirection = state == 'Downhill' ? 'Down' : '';
            MapData.view.dirty = true;
        }
    },
    {
        label: 'Terrain',
        id: 'dropdown_terrain',
        options: [
            'None',
            'Simple',
            'DVRT',
        ],
        state: 'None',
        func: state =>{
            let mapTerrain = document.getElementById('mapTerrain');
            if(state == 'None'){
                MapData.layers.terrain = false;
                MapData.view.dirty = true;
            }else{
                mapTerrain.onload = () => {
                    MapData.layers.terrain = true;
                    MapData.view.dirty = true;
                }
                if(state == 'Simple'){
                    document.getElementById('mapTerrain').src = 'terrains/simple.jpg';
                }else if(state == 'DVRT'){
                    document.getElementById('mapTerrain').src = 'terrains/dvrt.jpg';
                }
            }
        }
    }
];

const legendKey = document.getElementById('legendKey');

export function initialize(){
    const settingsPanel = document.getElementById('settingsPanel');
    for(let thisSetting of settingEntries){
        addSettingEntry(thisSetting, settingsPanel);
    }
    const legend = document.getElementById('legend');
    const legendContents = document.getElementById('legendContents');
    const legendButton = document.getElementById('legendButton');
    const legendArrow = legendButton.children[0];
    let legendState = true;
    let legendButtonEvent = e => {
        legendArrow.style.transform = `rotate(${legendState ? 180 : 0}deg) translateY(${legendState ? -0 : 0}px)`;
        legend.style.transform = `translateX(${legendState ? 0 : -legendContents.clientWidth}px)`;
        legendState = !legendState;
    };
    legendButton.addEventListener('click', legendButtonEvent);
    legendButtonEvent();
    if(document.body.clientWidth <= 700) legendButtonEvent();
    populateKey();
    setLastUpdateData();
};

function addSettingEntry(thisSetting, parent, indent=0){
    thisSetting.divContainer = document.createElement('div');
    thisSetting.labelElement = document.createElement('label');
    thisSetting.divContainer.appendChild(thisSetting.labelElement);

    let settingType = thisSetting.id.split('_')[0];
    switch(settingType){
        case 'toggle':
            thisSetting.inputElement = document.createElement('input');
            thisSetting.inputElement.type = 'checkbox';
            thisSetting.inputElement.checked = thisSetting.state;

            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('input', e =>{
                    thisSetting.func(e.target.checked);
                    if(thisSetting.children){
                        for(const child of thisSetting.children){
                            document.getElementById(child.id).parentElement.style.display = e.target.checked ? '' : 'none';
                        }
                    }
                });
            }
            break;
        case 'dropdown':
            thisSetting.inputElement = document.createElement('select');
            for(let inputEntry of thisSetting.options){
                let optionElement = document.createElement('option');
                if(typeof(inputEntry) == 'object'){
                    optionElement.value = inputEntry[0];
                    optionElement.innerHTML = inputEntry[1];
                }else{
                    optionElement.value = inputEntry;
                    optionElement.innerHTML = inputEntry;
                }
                if(inputEntry == thisSetting.state) optionElement.selected = true;
                thisSetting.inputElement.appendChild(optionElement);
            }
            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('change', e =>{
                    thisSetting.func(e.target.value);
                })
            }
            break;
        case 'slider':
            thisSetting.inputElement = document.createElement('input');
            thisSetting.inputElement.type = 'range';
            thisSetting.inputElement.min = thisSetting.min ?? 0;
            thisSetting.inputElement.max = thisSetting.max ?? 100;
            thisSetting.inputElement.step = thisSetting.step ?? 1;
            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('input', e => {
                    thisSetting.func(e.target.value);
                });
            }
            break;
        default:
            thisSetting.divContainer.remove();
            return;
    }
    parent.appendChild(thisSetting.divContainer);
    thisSetting.labelElement.innerHTML = thisSetting.label;
    thisSetting.labelElement.htmlFor = thisSetting.id;
    thisSetting.inputElement.id = thisSetting.id;

    thisSetting.inputElement.style.margin = `0 0.5em 0 ${indent}em`;
    thisSetting.divContainer.prepend(thisSetting.inputElement);

    if(thisSetting.func){
        thisSetting.func(thisSetting.state);
    }

    if(thisSetting.children){
        for(let child of thisSetting.children){
            addSettingEntry(child, parent, indent+1);
        }
    }
}

let pageLoadUpdateDate = null;
async function setLastUpdateData(){
    if(!window.location.host.includes('github')) return;
    let commits = await (await fetch(new Request('https://api.github.com/repos/PyroNicampt/DV-Community-Map/commits'))).json();
    let lastUpdateElement = document.getElementById('lastUpdate');
    if(!commits){
        lastUpdateElement.innerHTML = '<a href="https://github.com/PyroNicampt/DV-Community-Map/commits/main/" title="Could not fetch commit history">Fetch Error</a>';
        return;
    };
    let updateDate = new Date(commits[0].commit.author.date);
    lastUpdateElement.innerHTML = `<a href="https://github.com/PyroNicampt/DV-Community-Map/commits/main/" title="${updateDate.toString()}">${Utils.formattedTimeBetweenDates(new Date(), updateDate)} ${new Date() >= updateDate ? 'ago' : 'from now'}</a>`;
    document.getElementById('changelog').innerHTML = commits[0].commit.message.replaceAll(/\n+/g, '\n').replaceAll('\n','<br>');
    if(pageLoadUpdateDate == null){
        pageLoadUpdateDate = updateDate;
    }else{
        if(updateDate.valueOf() != pageLoadUpdateDate.valueOf()){
            lastUpdateElement.innerHTML += ' Reload page to see changes!';
        }
    }

    setTimeout(() => {setLastUpdateData()}, 600000);
}

function populateKey(){
    addKeyEntry('gradeArrow', 'Grade Indication')
    addKeyEntry('speed_5', 'Speed Limit');
    addKeyEntry('junction', 'Junction/Switch');
    addKeyEntry('office', 'Station Office');
    addKeyEntry('shop', 'Shop');
    addKeyEntry('service_repair', 'Repair Service');
    addKeyEntry('service_diesel', 'Diesel Refuel');
    addKeyEntry('service_charger', 'Electric Charger');
    addKeyEntry('coal', 'Coal Tower');
    addKeyEntry('water', 'Water Tower');
    addKeyEntry('landmark', 'Landmark');
    addKeyEntry('garage', 'Garage');
    addKeyEntry('demonstrator', 'Demonstrator Spawn');
    //Add empty entries to make entries align right in the columns.
    for(let i=0; i<3; i++){
        addKeyEntry();
    }
}

/**
 * Add an entry to the map key.
 * @param {string} keyImageHTML
 * @param {string} keyLabel
 */
function addKeyEntry(keySprite, keyLabel){
    if(!keyLabel) keyLabel = '&nbsp;';
    let keyDiv = document.createElement('div');
    if(keySprite && Config.spriteBounds[keySprite]){
        let keyImage = document.createElement('span');
        let spriteBounds = Config.spriteBounds[keySprite];
        keyImage.classList.add('inlineSvg');
        keyImage.style.background = `url('mapSprites.svg') -${spriteBounds.x/spriteBounds.width}em -${spriteBounds.y/spriteBounds.height}em`;
        keyImage.style.backgroundSize = '1000%';
        keyDiv.appendChild(keyImage);
        keyLabel = ' '+keyLabel;
    }
    keyDiv.innerHTML += keyLabel;
    legendKey.appendChild(keyDiv);
}