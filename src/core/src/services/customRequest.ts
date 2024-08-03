///<reference lib="esnext"/>


const requestFilter = { urls: ["<all_urls>"] },
      extraInfoSpec = ['requestHeaders', 'blocking', 'extraHeaders'];

// const xmlHttpRequest = (url: string, options: XMLHttpRequestBodyInit) =>
// {
//     return new Promise((resolve, reject) =>
//     {
//         const xhr = new XMLHttpRequest();
//         xhr.open("GET", url);
//         xhr.setRequestHeader('Referrer')
//         xhr.onerror = function(e)
//         {
//             console.error(e)
//             reject()
//         }
//         xhr.onreadystatechange = function(e)
//         {
//             if (xhr.readyState == 4) { resolve(xhr.responseText) }
//         }

//         xhr.send()
//     })
// }

export const CustomReferrerHeaderKey = 'referrer-custom'

export const addCustomReferrer = (referrerUrl: string, init: RequestInit = { }) =>
{
    const headers = new Headers(init.headers)
    headers.append(CustomReferrerHeaderKey, referrerUrl)
    console.debug('addCustomReferrer: %s: %s', CustomReferrerHeaderKey, referrerUrl)
    init.headers = headers
    return init
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    details =>
    {
        // console.log('onBeforeSendHeaders: %s', details.url.split(/\//gm).at(-1))
        if(details.url.includes('m3u8'))
        {
            console.log('onBeforeSendHeaders: %s', details.url.split(/\//gm).at(-1))
        }

        if((!details.requestHeaders) || details.requestHeaders.length === 0)
        {
            console.log('%conBeforeSendHeaders: NO HEADERS', 'opacity: 0.6')
            return { }
        }

        const customReferrer = details.requestHeaders.find(({name}) => name === CustomReferrerHeaderKey)?.value
        if(!customReferrer)
        {
            // console.log('onBeforeSendHeaders: NO %s HEADER', CustomReferrerHeaderKey)
            return { requestHeaders: details.requestHeaders }
        }

        console.log('%conBeforeSendHeaders: CUSTOM REFERRER: %s', 'font-size: 1.1em; font-weight: 700', customReferrer)
        details.requestHeaders.push({name: 'referer', value: customReferrer});
        return {requestHeaders: details.requestHeaders};
    },
    requestFilter,
    extraInfoSpec
);

chrome.webRequest.onBeforeSendHeaders.addListener(details =>
    {
        if(!details.url.includes('m3u8')) { return }
        const { url } = details
        console.log('onBeforeSendHeaders: %s\n%o', url, details.requestHeaders)
    },
    requestFilter,
    extraInfoSpec
);

