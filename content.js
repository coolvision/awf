import OpenAI from 'openai';

const getObjectFromLocalStorage = async function (key) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(key, function (value) {
                resolve(value[key]);
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

const saveObjectInLocalStorage = async function(obj) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(obj, function() {
          resolve();
        });
      } catch (ex) {
        reject(ex);
      }
    });
  };

let settings = await getObjectFromLocalStorage("settings");
let api_key = settings.apiKey;
let openai = new OpenAI({ apiKey: api_key, dangerouslyAllowBrowser: true });

async function sendPageContent() {

    let settings = await getObjectFromLocalStorage("settings");
    let blacklist = settings.blacklist.split('\n');
    let whitelist = settings.whitelist.split('\n');

    for (let w of whitelist) {
        if (window.location.href.includes(w)) {
            console.log("page is whitelisted", window.location.href, w);
            return;
        }
    }
    for (let b of blacklist) {
        if (window.location.href.includes(b)) {
            console.log("page is blacklisted", window.location.href, b);
            blockPage("page is blacklisted", window.location.href);
            return;
        }
    }

    const textContent = document.body.innerText;
    let text = window.location.href + '\n' + textContent.substring(0, 2000);
    let prompt = settings.prompt + '\n' + text;

    console.log('prompt:', prompt);
    console.log("use model", settings.model);

    hidePage();

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: settings.model,
    });

    let a = completion.choices[0].message.content;
    let info = a.split('\n').slice(1).join('\n');
    let do_block = a.includes("YES");

    console.log("chat response:", a, info, a.split('\n'));

    saveObjectInLocalStorage({
        [window.location.href]: {
                href: window.location.href,
                decision: do_block,
                info: info.trim() 
            }
        });

    console.log("block?", do_block);

    if (do_block) {
        blockPage(info, window.location.href);
    } else {
        document.getElementById("hide_overlay_012345").style.display = "none";
    }
}

function blockPage(info, href) {
    window.stop()
    document.querySelector('head').innerHTML = "";
    document.querySelector('body').innerHTML = `
    <div>
        <b style="display:block;font-size:48px">This page was blocked by a content filter</b>
        <b style="display:block;font-size:32px">${href}, reason for the block:</b>
        <span style="display:block;font-size:32px">${info}<\span>
    </div>
    `
}

function hidePage() {

    var div = document.createElement("div");
    div.id = "hide_overlay_012345";
    div.style.position = "fixed";

    div.style.width = "100%";
    div.style.height = "100%";
    div.style.backgroundColor = "rgba(255,255,255,1)";

    div.style.top = "0";
    div.style.left = "0";
    div.style.right = "0";
    div.style.bottom = "0";
    div.style.zIndex = "1000000";

    div.style.textAlign = "center";
    div.style.paddingTop = "50px";
    div.style.fontFamily = "sans-serif";
    div.style.color = "black";
    div.style.fontSize = "24px";
    
    div.innerHTML = "Validating page content...";
    document.body.prepend(div);
}

let cached = await getObjectFromLocalStorage(window.location.href);
console.log("check cached", cached);

if (cached) {

    if (cached.decision) {
        blockPage(cached.info, cached.href);
    }

} else {

    if (document.readyState === 'complete') {
        // If the page is already loaded, send the message immediately
        console.log('Page is already loaded, sending message immediately')
        sendPageContent();
    } else {
        console.log('Page is not loaded, waiting for load event')
        window.addEventListener('load', sendPageContent);
    }
}