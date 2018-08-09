export const getUniqueId = () => ('' + new Date().getTime() + Math.random()).split('.').join('_')

// 用于将React 的 this.props.children 转换成一个 map
export const keyedChildren = (children) => {
    const map = {}
    if (children ) {
        if (children.length && typeof children.map == 'function') {
            children.map(item => map[item.key] = item)
        } else {
            map[children.key] = children
        }
    }
    return map
}

// ----------------------------- Calendar 专属 utils -------------------------------------------

export const parseDateFormat = (format) => {
    let separator = format.match(/[.\/\-\s].*?/) || '/'
    let parts = format.split(/\W+/)

    if (!parts || parts.length === 0) {
        throw new Error('Invalid date format.')
    }

    let formats = {
        separator: separator[0],
        parts: parts
    }

    for (let i = 0, length = parts.length; i < length; i++) {
        switch (parts[i]) {
            case 'dd':
            case 'd':
                formats.day = true
                break
            case 'mmm':
            case 'mm':
            case 'm':
                formats.month = true
                break
            case 'yyyy':
            case 'yy':
                formats.year = true
                break
        }
    }
    return formats
}

export const parseDateString = (dateString, format) => {
    format = parseDateFormat(format)
    let parts = (typeof dateString === 'string' && dateString.length > 0 ?
        dateString.split(format.separator) : [])
    let length = format.parts.length
    let monOptions = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let year = 0
    let day = 1
    let month = 1
    let val = ''
    for (let i = 0; i < parts.length; i++) {
        val = parseInt(parts[i], 10)
        switch (format.parts[i]) {
            case 'dd':
            case 'd':
                if (typeof val === 'number' && val > 0 && val <= 31) {
                    day = val
                }
                break
            case 'mm':
            case 'm':
                if (typeof val === 'number' && val > 0 && val < 13) {
                    month = val
                }
                break
            case 'mmm':
                if (typeof val === 'number' && val > 0 && val < 13) {
                    month = val
                } else if (parts[i]) {
                    for (var j = 0; j < monOptions.length; j++) {
                        if (parts[i].toLowerCase() === monOptions[j].toLowerCase()) {
                            month = j
                        }
                    }
                }
                break
            case 'yy':
                if (typeof val === 'number' && val >= 0 && val < 100) {
                    year = 2000 + val
                }
                break
            case 'yyyy':
                if (typeof val === 'number' && val >= 1000 && val < 10000) {
                    year = val
                }
                break
        }
    }

    // check day
    var checkDate = new Date(year, month - 1, day)
    if (checkDate.getFullYear() !== year || checkDate.getMonth() != month - 1) {
        day = 1
    }

    return {year, month, day}
}

export const convertStringToDate = (dateString, format) => {
    const {year, month, day} = parseDateString(dateString, format)
    return new Date(year, month - 1, day)
}

export function getToday() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// // ------------------ 弹出 alert / confirm / image preview------------------
// import bridge from 'Component/OuterWrapper/bridge'
//
// export function showAlert(title, message, onClose) {
//     var alertId = getUniqueId()
//
//     var props = {
//         title, message,
//         onClose() {
//             bridge.removeAlert(alertId)
//             onClose && onClose()
//         }
//     }
//
//     bridge.renderAlert(alertId, props)
// }
//
// export function showConfirm(title, message, onConfirm, onCancel) {
//     var confirmId = getUniqueId()
//     var props = {
//         title, message,
//         onConfirm() {
//             bridge.removeConfirm(confirmId)
//             onConfirm && onConfirm()
//         },
//         onCancel() {
//             bridge.removeConfirm(confirmId)
//             onCancel && onCancel()
//         }
//     }
//
//     bridge.renderConfirm(confirmId, props)
// }
//
// export function showImagePreview(imageList, showIndex, onClose) {
//     var imagePreviewId = getUniqueId()
//
//     var props = {
//         imageList,
//         showIndex,
//         onClose() {
//             bridge.removeImagePreview(imagePreviewId)
//             onClose && onClose()
//         }
//     }
//
//     bridge.renderImagePreview(imagePreviewId, props)
// }
//
// // ---------- show message -------------------
//
// export function showMessage(type, message, fadeDelay) {
//     bridge.showToasterMessage(type, message, fadeDelay)
// }

// ---------- 同步内嵌 iframe 高度 ---------------

export function syncHeightWithOuter(iframeId, contentId, margin = 0) {
    // console.log(window.top)

    if (window.top) {
        const topDocument = window.top.document
        if (!topDocument) {
            console.log('[WARN] iframe 内容区域必须在相同的域内部署')
        } else {
            setInterval(x => {
                const height = document.getElementById(contentId).clientHeight

                const iframe = topDocument.getElementById(iframeId)

                if (iframe) {
                    iframe.style.height = height + margin + 'px'
                }
            }, 300)
        }
    }
}

// ---------- PAGE EXTRA -----------

export function parseExtraParams() {
    var pageExtraParams = window.pageExtraParams || {};

    return pageExtraParams
}