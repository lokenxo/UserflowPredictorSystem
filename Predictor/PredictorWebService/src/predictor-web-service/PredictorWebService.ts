import express from 'express';
import * as WebSocket from 'ws';
import * as http from 'http';
import cors from 'cors';
import * as bodyParser from "body-parser";
import fs from 'fs';
import {Data} from "../../../../DataGatherer/src/data/Data";
import {createCanvas, Image} from "canvas";

export class PredictorWebService {

    private portWebSocket: number;
    private portApi: number;
    private url: string;
    private app: express.Application;
    private httpServer: http.Server; 
    private wss: WebSocket.Server;


    private oldImageData: Data;
    constructor(url: string, portApi: number, portWebSocket: number) {
        this.url = url;
        this.portApi = portApi;
        this.portWebSocket = portWebSocket;
    }

    public startWebSocket() {
        this.httpServer = http.createServer(this.app);
        this.wss = new WebSocket.Server({port: this.portWebSocket});

        this.wss.on('connection', (ws: WebSocket) => {
            const that = this;
            ws.on('message', (message: string) => {
                const jsonMsg = JSON.parse(message);
                const data: Array<Data> = jsonMsg.map(d => new Data(d.name, d.data, d.size, d.timestamp));
                let image = data.find(val => {
                    return val.getName() === 'screen';
                });
                if(image) {
                    that.saveImage(image);
                    that.applyDataToImage(image, data)
                        .then(val => {
                            ws.send(val);
                        });
                } else {
                    that.applyDataToImage(that.oldImageData, data)
                        .then(val => {
                            ws.send(val);
                        });
                }
            });
        });
    }

    public startExpress() {
        const that = this;
        this.app = express();
        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));

        this.app.post('/predict', function (req, res) {
            function generateFakeResponse() {
                return Array.from({length: 20}, () => Math.random().toPrecision(2));
            }
            console.log('Request prediction');
            res.send(generateFakeResponse());
        });

        this.app.listen(this.portApi, () => {
            console.log('PredictorWebService is up and running on port: %d', this.portApi);
        }); 
    }

    printMouseClick(mouseclicks: Array<Data>, ctx: any) {
        ctx.strokeStyle = 'rgba(219, 10, 91, 0.5)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        for(const move of mouseclicks){
            ctx.strokeRect(move.getData().x, move.getData().y,10, 10);
        }
        ctx.stroke();
    }

    printMouseMove(mousemoves: Array<Data>, ctx: any) {
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        for(const move of mousemoves){
            ctx.lineTo(move.getData().x, move.getData().y);
        }
        ctx.stroke();
    }

    printKeyboard(keyboard: Array<Data>, ctx: any) {

    }

    printImage(image: Image, ctx: any){
        ctx.drawImage(image, 0, 0);
    }

    applyDataToImage(image: Data, data: Array<Data>) {
        return new Promise((resolve, reject) => {
            const mouseClicks = data.filter(val => {
                return val.getName() === 'click';
            });
            const mouseMovements = data.filter(val => {
                return val.getName() === 'mousemove';
            });
            const keyboard = data.filter(val => {
                return val.getName() === 'keydown';
            });
            if (image) {
                const canvas = createCanvas(image.getSize().width, image.getSize().height);
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                    this.printImage(img, ctx);
                    this.printMouseClick(mouseClicks, ctx);
                    this.printMouseMove(mouseMovements, ctx);
                    this.printKeyboard(keyboard, ctx);
                    const base64data = canvas.toBuffer();
                    fs.writeFile('./trainingDatas/' + image.getTimestamp() + '-' + Date.now() + '.png', base64data, 'base64', function (err) {
                        if (err) throw err;
                        console.log('File saved.');
                        resolve('ok - image received');
                    })
                };
                img.onerror = err => {
                    throw err
                };
                img.src = image.getData();
            } else {
                resolve('ok - only datas');
            }
        });

    }
    saveImage(image: Data) {
        if(image) {
            this.oldImageData = image;
        }
    }
}
