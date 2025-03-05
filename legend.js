'use strict';

import * as Utils from './js/utillib.js';
import * as Config from './config.js';
import { Color } from './js/colorlib.js';
import { setTrackColorMode } from './index.js';

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
        default: 'Grade',
        func: state =>{
            setTrackColorMode(state);
        }
    },
    {
        label: 'Signage',
        id: 'toggle_signage',
        state: true,
        func: state =>{
            document.getElementById('signage_container').style.display = state ? 'unset' : 'none';
        },
        children: [
            {
                label: 'Speed Signs',
                id: 'toggle_speedSigns',
                state: true,
                func: state =>{
                    document.getElementById('signage_speed').style.display = state ? 'unset' : 'none';
                },
            },
            {
                label: 'Grade Arrows',
                id: 'toggle_gradeSigns',
                state: true,
                func: state =>{
                    document.getElementById('signage_grade').style.display = state ? 'unset' : 'none';
                },
            },
            {
                label: 'Yard Signage',
                id: 'toggle_yardSigns',
                state: true,
                func: state =>{
                    document.getElementById('signage_yard').style.display = state ? 'unset' : 'none';
                },
            },
            {
                label: 'Junctions',
                id: 'toggle_junctions',
                state: false,
                func: state =>{
                    document.getElementById('signage_junction').style.display = state ? 'unset' : 'none';
                },
            }
        ],
    },
    {
        label: 'Points of Interest',
        id: 'toggle_poi',
        state: true,
        func: state => {
            document.getElementById('poi_container').style.display = state ? 'unset' : 'none';
        },
        children: [
            {
                label: 'Services',
                id: 'toggle_services',
                state: true,
                func: state =>{
                    document.getElementById('poi_service').style.display = state ? 'unset' : 'none';
                },
            },
            {
                label: 'Landmarks',
                id: 'toggle_landmarks',
                state: true,
                func: state =>{
                    document.getElementById('poi_landmarks').style.display = state ? 'unset' : 'none';
                },
            },
        ]
    },
    {
        label: 'Grade Arrow Direction',
        id: 'dropdown_gradeArrowDirection',
        options: [
            'Uphill',
            'Downhill',
        ],
        default: 'Uphill',
        func: state =>{
            let newHref = state == 'Uphill' ? '#gradeArrow' : '#gradeArrowDownhill';
            for(let arrow of document.getElementsByClassName('gradeArrow')){
                arrow.setAttribute('href', newHref);
            }
        }
    },
];

const legendKey = document.getElementById('legendKey');

document.addEventListener('DOMContentLoaded', async () => {
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
});

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
                if(inputEntry == thisSetting.default) optionElement.selected = true;
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

    if(thisSetting.children){
        for(let child of thisSetting.children){
            addSettingEntry(child, parent, indent+1);
        }
    }
}

let pageLoadUpdateDate = null;
async function setLastUpdateData(){
    let commits = await (await fetch(new Request('https://api.github.com/repos/PyroNicampt/DV-Community-Map/commits'))).json();
    let lastUpdateElement = document.getElementById('lastUpdate');
    let updateDate = new Date(commits[0].commit.author.date);
    
    lastUpdateElement.innerHTML = `<a href="https://github.com/PyroNicampt/DV-Community-Map/commits/main/" title="${updateDate.toString()}">${Utils.formattedTimeBetweenDates(new Date(), updateDate)} ago</a>`;
    if(pageLoadUpdateDate == null){
        pageLoadUpdateDate = updateDate;
    }else{
        if(updateDate.valueOf() != pageLoadUpdateDate.valueOf()){
            lastUpdateElement.innerHTML += ' Reload page to see changes!';
        }
    }

    setTimeout(() => {setLastUpdateData()}, 900000);
}

function populateKey(){
    const getGradeValue = gradeIndex => {return Math.round(Utils.gradeIncrements[Utils.gradeIncrements.length-gradeIndex-1]*10000)/100};
    for(let i=-1; i<Utils.gradeIncrements.length; i++){
        let gradeValue = `< ${getGradeValue(0)}`;
        let gradeIndex = 'flat';
        if(i>=0){
            gradeValue = `${getGradeValue(i)}`;
            gradeIndex = i;
        }
        if(i == Utils.gradeIncrements.length-1){
            gradeValue = '> '+gradeValue+'%';
        }else if(i >= 0){
            gradeValue += ` - ${getGradeValue(i+1)}%`;
        }
        addKeyEntry(`<use fill="${Config.gradeColors['grade_'+gradeIndex]}" href="#gradeArrow" transform="rotate(90)"/>`, ` ${gradeValue} Grade`);
    }
    addKeyEntry('<use href="#speedSign_5"/>', ' Speed Limit');
    addKeyEntry('<use href="#junctionSign" fill="#de2121" transform="scale(0.75)"/>', ' Junction/Switch');
    addKeyEntry('<use href="#mrk_office" fill="#c4693e" transform="scale(0.75)"/>', ' Station Office');
    addKeyEntry('<use href="#mrk_shop" fill="#4f54e9" transform="scale(0.75)"/>', ' Shop');
    addKeyEntry('<use href="#mrk_service_repair" fill="#239a96" transform="scale(0.75)"/>', ' Repair Service');
    addKeyEntry('<use href="#mrk_service_diesel" fill="#239a96" transform="scale(0.75)"/>', ' Diesel Refuel');
    addKeyEntry('<use href="#mrk_service_charger" fill="#239a96" transform="scale(0.75)"/>', ' Electric Charger');
    addKeyEntry('<use href="#mrk_coal" fill="#202020" transform="scale(0.75)"/>', ' Coal Tower');
    addKeyEntry('<use href="#mrk_water" fill="#3fa5ff" transform="scale(0.75)"/>', ' Water Tower');
    addKeyEntry('<use href="#mrk_landmark" fill="#af5757" transform="scale(0.75)"/>', ' Landmark');
    addKeyEntry('<use href="#mrk_garage" fill="#8b5dd7" transform="scale(0.75)"/>', ' Garage');
    //Add empty entries to make entries align right in the columns.
    for(let i=0; i<2; i++){
        addKeyEntry();
    }
}

/**
 * Add an entry to the map key.
 * @param {string} keyImageHTML
 * @param {string} keyLabel
 */
function addKeyEntry(keyImageHTML, keyLabel){
    if(!keyLabel) keyLabel = '&nbsp;';
    let keyDiv = document.createElement('div');
    if(keyImageHTML){
        let keyImage = document.createElement('svg');
        keyImage.innerHTML = keyImageHTML;
        keyImage.classList.add('inlineSvg');
        keyImage.setAttribute('viewBox', '-150 -150 300 300');
        keyDiv.appendChild(keyImage);
    }
    keyDiv.innerHTML += keyLabel;
    legendKey.appendChild(keyDiv);
}