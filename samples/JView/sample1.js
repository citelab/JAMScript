jdata {
    float temp as logger;
    int pos as logger;
}

jview {
    page1 as page {
        disp1 is display {
            type: stackedgraph;
            title: 'Temperature';
            source: temp;
            options: 'blah blah';
        }
    }
    page2 as page {
        disp2 is display {
            type: stackedgraph;
            title: 'Temp';
            source: pos;
            options: "blah2 blah2";
        }
    }
}
