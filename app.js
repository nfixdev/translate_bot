import telegrambot from "node-telegram-bot-api";
import fs from "fs";
import mysql2 from "mysql2";
import { response } from "express";
import { URLSearchParams } from "url";
const token = '6907053411:AAGJSS3brYYfaedW0GIfPW4QtGzcvfdG59g';
const bot = new telegrambot(token, { polling: true });
const folder_id = 'b1g77k4f5dsnsumtgqj9';

const iam_token = 't1.9euelZqbzszOzZmLl8-dkMybzp3GmO3rnpWanpOakY6PiY3PlMaOyJWVyJbl8_cjAzRS-e91cGNW_t3z92MxMVL573VwY1b-zef1656VmpeOk5uSi4-OycyYj86ezI-W7_zF656VmpeOk5uSi4-OycyYj86ezI-WveuelZrGipLJl5SJjJbHjc3PkImWmrXrnpWal5may86Xl5OWjsuRxsyOzpg.T4bdd7q1EjLLHZqFokRH-HMbmAeJmOp30xZy-C87KOSzQvUXY_1oeQSt_8PJh1U4PvoXUk7IEiRO1WE0VgYyAQ';

const TRANSLATOR_API_KEY = 'AQVN1s3_-dJv3Vic6VBHZ76G0RDqXlSdL37peFJU';
const SPEECH_API_KEY = 'AQVNzQwFMU0sL1tMG3pr6zAZ79Xl45_M0AmlAayL';

const translatorSettings = {
    autodetect: 0,
    default_src_lang: "ru",
    default_targ_lang: "en"
};

const connection = mysql2.createConnection({
    host: "localhost",
    user: "root",
    database: "translatebot",
    password: ''
});

connection.connect(function (err) {
    if (err) {
        return console.error("Ошибка: " + err.message);
    }
    else {
        console.log("Подключение к серверу установленно");
    }
});

async function translate(message, source_lang, target_lang) {
    const body_f = {
        "sourceLanguageCode": source_lang,
        "targetLanguageCode": target_lang,
        "texts": [message],
        "folderId": folder_id,
    };
    console.log("Body of request: " + JSON.stringify(body_f));
    const headers_f = {
        "Content-Type": "application/json",
        "Authorization": "Api-Key " + TRANSLATOR_API_KEY,
    };
    const ans = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
        method: "POST",
        headers: headers_f,
        body: JSON.stringify(body_f)
    });
    const data = await ans.json();
    return data;
}

async function detectLanguage(text) {
    const body_f = {
        "folderId": folder_id,
        "text": text
    };
    const headers_f = {
        "Content-Type": "application/json",
        "Authorization": "Api-Key " + TRANSLATOR_API_KEY
    };
    const ans = await fetch('https://translate.api.cloud.yandex.net/translate/v2/detect', {
        method: "POST",
        headers: headers_f,
        body: JSON.stringify(body_f)
    });
    return await ans.json();
}

bot.on('message', async (msg) => {
    if (msg.text === '/start' || msg.text === '/help') {
        bot.sendMessage(msg.chat.id, "Здесь вы можете получить подробную информацию: https://github.com/nfixdev/translate_bot#readme")
        connection.query('insert into users(id, settings) values(?,?)', [msg.chat.id, JSON.stringify(translatorSettings)], async (err) => {
            if (err) throw err;
        });
    }
    else if (msg.text.startsWith('#')) {
        const varName = msg.text.substring(1, msg.text.indexOf(' '));
        const value = msg.text.substring(varName.length + 2).trim();
        connection.query('select settings from users where id=?', [msg.chat.id], function (err, result) {
            if (result.length === 0) {
                connection.query('insert into users(id, settings) values(?, ?)', [msg.chat.id, JSON.stringify(translatorSettings)]);
                result = [{ settings: JSON.stringify(translatorSettings) }];
            }
            const settings = JSON.parse(result[0].settings);
            settings[varName] = value;
            connection.query('update users set settings=? where id=?', [JSON.stringify(settings), msg.chat.id], function (err) {
                if (err) {
                    throw err;
                }
            });
            bot.sendMessage(msg.chat.id, `Переменная '${varName}' успешно изменена на '${value}'`);
        });
    }
    else {
        connection.query('select settings from users where id=?', [msg.chat.id], async (err, result) => {
            if (result.length === 0) {
                connection.query('insert into users(id, settings) values(?, ?)', [msg.chat.id, JSON.stringify(translatorSettings)], (err) => { console.log(err.message); });
                result = [{ settings: JSON.stringify(translatorSettings) }];
            } else {
                const settings = JSON.parse(result[0].settings);
                if (settings.autodetect == "1") {
                    detectLanguage(msg.text).
                        then(response => {
                            const src = response.languageCode;
                            const targ = settings.default_targ_lang;
                            const qestion = msg.text;
                            translate(qestion, src, targ).then(response => {
                                console.log(response);
                                bot.sendMessage(msg.chat.id, `${response.translations[0].text}`);
                            })
                                .catch(message => { bot.sendMessage(msg.chat.id, "Произошла ошибка!"); console.log(message) });
                        })
                        .catch(message => {
                            bot.sendMessage(msg.chat.id, "Произошла ошибка: " + message.message);
                            console.log(message);
                        });
                }
                else {
                    translate(msg.text, settings.default_src_lang, settings.default_targ_lang)
                        .then(response => bot.sendMessage(msg.chat.id, `${response.translations[0].text}`))
                        .catch(message => bot.sendMessage(msg.chat.id, "Произошла ошибка!"));
                }
            }
        });
    }
});

bot.on('inline_query', async (query) => {
    connection.query('select settings from users where id=?', [query.from.id], async (err, result) => {
        if (result.length == 0) {
            connection.query('insert into users(id, settings) values(?, ?)', [query.from.id, JSON.stringify(translatorSettings)]);
            result = [{ settings: JSON.stringify(translatorSettings) }];
        } else {
            const settings = JSON.parse(result[0].settings);
            if (settings.autodetect == "1") {
                detectLanguage(query.query).then(response => {
                    const src = response.languageCode;
                    const targ = settings.default_targ_lang;
                    if (query.query != '') {
                        translate(query.query, src, targ).then(response => {
                            const obj = {
                                type: 'article',
                                id: "1",
                                title: 'Перевод',
                                description: response.translations[0].text,
                                input_message_content: {
                                    message_text: response.translations[0].text,
                                }
                            };
                            bot.answerInlineQuery(query.id, [obj]).then(response => console.log("answerInlineQuery")).catch(response => console.log("error"));
                        });
                    }
                });
            }
            else {
                if (query.query != '') {
                    translate(query.query, settings.default_src_lang, settings.default_targ_lang).then(response => {
                        const obj = {
                            type: 'article',
                            id: "1",
                            title: 'Перевод',
                            description: response.translations[0].text,
                            input_message_content: {
                                message_text: response.translations[0].text,
                            }
                        };
                        bot.answerInlineQuery(query.id, [obj]).then(response => console.log("answerInlineQuery")).catch(response => console.log("error"));
                    });
                }
            }
        }
    });
});

bot.on('polling_error', (msg) => { console.log(msg.err); });

