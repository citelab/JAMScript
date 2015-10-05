jamdef void test(){
	void onload() {
		var a;
		console.log("Hello World!");
	};
}

jamdef void bad(){
	void onload() {
		var a;
		blah("Hello World!");
	};
	void onerror() {
		printf("Error received\n");
	};
}

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
                test_load();
                break;
            case 2:
                bad_load();
                break;
            case 3:
                loop = 0;
                break;
        }
    }
    return 0;
}
