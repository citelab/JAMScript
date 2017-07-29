import React, {createElement} from 'react'

export const createBaseElem = (tagName) => {
    return (className, props = {}, ...content) => {
        1;
        if (typeof className == 'object') {
            return createElement(tagName, className, props, ...content)
        } else {
            props.className = props.className || className
            return createElement(tagName, props, ...content)
        }
    }
}

export const tr = createBaseElem('tr')
export const td = createBaseElem('td')
export const div = createBaseElem('div')
export const span = createBaseElem('span')
export const label = createBaseElem('label')
export const a = createBaseElem('a')
export const h1 = createBaseElem('h1')
export const h2 = createBaseElem('h2')
export const h3 = createBaseElem('h3')
export const h4 = createBaseElem('h4')
export const h5 = createBaseElem('h5')
export const h6 = createBaseElem('h6')
export const thead = createBaseElem('thead')
export const tbody = createBaseElem('tbody')
export const table = createBaseElem('table')
export const aside = createBaseElem('aside')
export const header = createBaseElem('header')
export const footer = createBaseElem('footer')
export const section = createBaseElem('section')
export const article = createBaseElem('article')
export const em = createBaseElem('em')
export const strong = createBaseElem('strong')
export const img = createBaseElem('img')
export const input = createBaseElem('input')
export const button = createBaseElem('button')
export const textarea = createBaseElem('textarea')
export const p = createBaseElem('p')
export const form = createBaseElem('form')
export const iframe = createBaseElem('iframe')