class Box{
    constructor(){
        var box = document.createElement('div');
        box.setAttribute("style", 'display:inline-block; width: 100px; height: 100px; border: 1px solid #333');

        this.box = box;
        this.properties = {};
    }

    set id(id){
        this.box.setAttribute("id", id);
    }

    get id(){
        return this.box.getAttribute("id");
    }

    get(){
        return this.box;
    }

    addEventListener(event, listener){
        this.box.addEventListener(event, listener);
    }

    setAttribute(){
        this.box.setAttribute.apply(this.box, arguments);
    }

    getAttribute(attr){
        return this.box.getAttribute(attr);
    }

    set style(s){
        this.box.style = s;
    }

    get style(){
        return this.box.style;
    }

    set className(c){
        this.box.className = c;
    }

    get className(){
        return this.box.className;
    }

    set innerHTML(data){
        this.box.innerHTML = data;
    }

    get innerHTML(){
        return this.box.innerHTML;
    }

    get parentNode(){
        return this.box.parentNode;
    }

    appendChild(){
        this.box.appendChild.apply(this.box, arguments);
    }

    removeChild(){
        this.box.removeChild.apply(this.box, arguments);
    }

    get firstChild(){
        return this.box.firstChild;
    }

    get lastChild(){
        return this.box.lastChild;
    }

    hasChildNodes(){
        return this.box.hasChildNodes();
    }

    setProperty(prop, val){
        this.properties[prop] = val;
    }

    getProperty(prop){
        return this.properties[prop];
    }
}