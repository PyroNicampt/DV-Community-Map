'use strict';

export class Color{
    r = 0;
    g = 0;
    b = 0;
    a = 1;

    /**
     * @param {number|string} r Red component, or a hex notation string
     * @param {number} g Green component
     * @param {number} b Blue component
     * @param {number} a Alpha component
     */
    constructor(r, g, b, a){
        if(typeof(r) == 'string'){
            r = r.replace('#', '');
            if(r.length == 3) r = r.charAt(0)+r.charAt(0)+r.charAt(1)+r.charAt(1)+r.charAt(2)+r.charAt(2);
            else if(r.length == 4) r = r.charAt(0)+r.charAt(0)+r.charAt(1)+r.charAt(1)+r.charAt(2)+r.charAt(2)+r.charAt(3)+r.charAt(3);
            if(r.length == 6 || r.length == 8){
                this.r = Number('0x'+r.substring(0,2))/255;
                this.g = Number('0x'+r.substring(2,4))/255;
                this.b = Number('0x'+r.substring(4,6))/255;
            }
            if(r.length == 8) this.a = Number('0x'+r.substring(6,8))/255;
        }else{
            this.r += r ?? this.r;
            this.g += g ?? this.g;
            this.b += b ?? this.b;
            this.a *= a ?? this.a;
        }
    }

    /** Returns the the html hexadecimal representation of this color */
    get hex(){
        return `#${
            Math.round(Math.min(Math.max(this.r,0),1)*255).toString(16).padStart(2, '0').substring(0,2)
        }${
            Math.round(Math.min(Math.max(this.g,0),1)*255).toString(16).padStart(2, '0').substring(0,2)
        }${
            Math.round(Math.min(Math.max(this.b,0),1)*255).toString(16).padStart(2, '0').substring(0,2)
        }${
            Math.round(Math.min(Math.max(this.a,0),1)*255).toString(16).padStart(2, '0').substring(0,2)
        }`;
    }

    /** Return a random color */
    static random(){
        return new Color(Math.random(), Math.random(), Math.random());
    }

    /**
     * Blend between two colors in the sRGB colorspace
     * @param {Color} colorA 
     * @param {Color} colorB 
     * @param {number} factor 
     * @returns {Color}
     */
    static blendSrgb(colorA, colorB, factor){
        if(factor <= 0) return colorA;
        if(factor >= 1) return colorB;
        let output = new Color();
        output.r = colorA.r*(1-factor) + colorB.r*factor;
        output.g = colorA.g*(1-factor) + colorB.g*factor;
        output.b = colorA.b*(1-factor) + colorB.b*factor;
        output.a = colorA.a*(1-factor) + colorB.a*factor;
        return output;
    }

    /**
     * Blend along a gradient of colors
     * @param {Color[]} colorList 
     * @param {number} factor 0-1 blend along `colorList`
     * @param {string} colorspace
     */
    static blendGradient(colorList, factor, colorspace = 'srgb'){
        if(colorList.length == 0) return new Color();
        if(colorList.length == 1 || factor <= 0) return colorList[0];
        if(factor >= 1) return colorList[colorList.length-1];

        let factorIndex = (colorList.length-1) * factor;
        switch(colorspace.toLowerCase()){
            default:
                return this.blendSrgb(colorList[Math.floor(factorIndex)], colorList[Math.ceil(factorIndex)], factorIndex % 1);
        }
    }
}