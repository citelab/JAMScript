#include "../lib/jamlib/jamlib.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

jamasync void test(char * i){
    void onload() {
		var a;
		console.log("Hello World " + i);
	};
    void onerror() {
        printf("Error received\n");
    };
    void oncomplete() {
        int a;
        printf("Completed!\n");
    };
}

/* jamsync int syncfunc(){
// 	var a = 3;
// 	return a;
// }
*/

int main() {
	int code;
    int loop = 1;
    while(loop) {
        printf("Your choice: \n \
                1 - Execute hello \n \
                2 - Trigger error \n \
                3 - Quit \n");

        scanf("%d", &code);
        switch (code) {
            case 1:
                test("hi");
                break;
            case 2:
                /* printf("%i\n", syncfunc()); */
                break;
            case 3:
                loop = 0;
                break;
        }
    }
    return 0;
}
