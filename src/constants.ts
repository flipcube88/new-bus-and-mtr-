export const mtrConfig = {
    lines: [
        { code: 'KTL', name: '觀塘綫', color: '#00ab4e' },
        { code: 'TWL', name: '荃灣綫', color: '#ed1d24' },
        { code: 'ISL', name: '港島綫', color: '#007dc5' },
        { code: 'TKL', name: '將軍澳綫', color: '#a35eb5' },
        { code: 'TML', name: '屯馬綫', color: '#9a3820' },
        { code: 'EAL', name: '東鐵綫', color: '#5eb3e4' },
        { code: 'TCL', name: '東涌綫', color: '#ff9233' },
        { code: 'AEL', name: '機場快綫', color: '#007078' },
        { code: 'SIL', name: '南港島綫', color: '#b5bd00' }
    ],
    stations: {
        'KTL': [{c:'WHA',n:'黃埔'},{c:'HOM',n:'何文田'},{c:'YMT',n:'油麻地'},{c:'MOK',n:'旺角'},{c:'PRE',n:'太子'},{c:'SKM',n:'石硤尾'},{c:'KOT',n:'九龍塘'},{c:'LOF',n:'樂富'},{c:'WTS',n:'黃大仙'},{c:'CHH',n:'彩虹'},{c:'DIW',n:'鑽石山'},{c:'KOB',n:'九龍灣'},{c:'NTK',n:'牛頭角'},{c:'KWT',n:'觀塘'},{c:'LAT',n:'藍田'},{c:'YAT',n:'油塘'},{c:'TIK',n:'調景嶺'}],
        'TWL': [{c:'CEN',n:'中環'},{c:'ADM',n:'金鐘'},{c:'TST',n:'尖沙咀'},{c:'JOR',n:'佐敦'},{c:'YMT',n:'油麻地'},{c:'MOK',n:'旺角'},{c:'PRE',n:'太子'},{c:'SSP',n:'深水埗'},{c:'CSW',n:'長沙灣'},{c:'LCK',n:'荔枝角'},{c:'MEF',n:'美孚'},{c:'LAK',n:'荔景'},{c:'KWF',n:'葵芳'},{c:'KWH',n:'葵興'},{c:'TWH',n:'大窩口'},{c:'TSW',n:'荃灣'}],
        'ISL': [{c:'KET',n:'堅尼地城'},{c:'HKU',n:'香港大學'},{c:'SYP',n:'西營盤'},{c:'SHW',n:'上環'},{c:'CEN',n:'中環'},{c:'ADM',n:'金鐘'},{c:'WAC',n:'灣仔'},{c:'CAB',n:'銅鑼灣'},{c:'TIH',n:'天后'},{c:'FOH',n:'炮台山'},{c:'NOP',n:'北角'},{c:'QUB',n:'鰂魚涌'},{c:'TAK',n:'太古'},{c:'SWH',n:'西灣河'},{c:'SKW',n:'筲箕灣'},{c:'HFC',n:'杏花邨'},{c:'CHW',n:'柴灣'}],
        'TKL': [{c:'NOP',n:'北角'},{c:'QUB',n:'鰂魚涌'},{c:'YAT',n:'油塘'},{c:'TIK',n:'調景嶺'},{c:'TKO',n:'將軍澳'},{c:'LHP',n:'康城'},{c:'HAH',n:'坑口'},{c:'POA',n:'寶琳'}],
        'TML': [{c:'WKS',n:'烏溪沙'},{c:'MOS',n:'馬鞍山'},{c:'HEO',n:'恆安'},{c:'TSH',n:'大水坑'},{c:'SHM',n:'石門'},{c:'CIO',n:'第一城'},{c:'STW',n:'沙田圍'},{c:'CKW',n:'車公廟'},{c:'TAI',n:'大圍'},{c:'HIK',n:'顯徑'},{c:'DIW',n:'鑽石山'},{c:'KAT',n:'啟德'},{c:'SUW',n:'宋皇臺'},{c:'TKW',n:'土瓜灣'},{c:'HOM',n:'何文田'},{c:'HUH',n:'紅磡'},{c:'ETS',n:'尖東'},{c:'AUS',n:'柯士甸'},{c:'NAC',n:'南昌'},{c:'MEF',n:'美孚'},{c:'TWW',n:'荃灣西'},{c:'KSR',n:'錦上路'},{c:'YUL',n:'元朗'},{c:'LOP',n:'朗屏'},{c:'TIS',n:'天水圍'},{c:'SIH',n:'兆康'},{c:'TUM',n:'屯門'}],
        'EAL': [{c:'ADM',n:'金鐘'},{c:'EXC',n:'會展'},{c:'HUH',n:'紅磡'},{c:'MKK',n:'旺角東'},{c:'KOT',n:'九龍塘'},{c:'TAI',n:'大圍'},{c:'SHT',n:'沙田'},{c:'FOT',n:'火炭'},{c:'RAC',n:'馬場'},{c:'UNI',n:'大學'},{c:'TAP',n:'大埔墟'},{c:'TWO',n:'太和'},{c:'FAN',n:'粉嶺'},{c:'SHS',n:'上水'},{c:'LOW',n:'羅湖'},{c:'LMC',n:'落馬洲'}],
        'TCL': [{c:'HOK',n:'香港'},{c:'KOW',n:'九龍'},{c:'OLY',n:'奧運'},{c:'NAC',n:'南昌'},{c:'LAK',n:'荔景'},{c:'TSY',n:'青衣'},{c:'SUN',n:'欣澳'},{c:'TUC',n:'東涌'}],
        'AEL': [{c:'HOK',n:'香港'},{c:'KOW',n:'九龍'},{c:'TSY',n:'青衣'},{c:'AIR',n:'機場'},{c:'AWE',n:'博覽館'}],
        'SIL': [{c:'ADM',n:'金鐘'},{c:'OCP',n:'海洋公園'},{c:'WCH',n:'黃竹坑'},{c:'LET',n:'利東'},{c:'SOH',n:'海怡半島'}]
    }
};

export const stationLookup: Record<string, string> = {};
Object.values(mtrConfig.stations).forEach(stops => stops.forEach(s => stationLookup[s.c] = s.n));
