int value = 10;

const int SIZE = 1024*1024*2;

struct _qqqq {
    char data[SIZE]; // Two megabyte buffer
} t;

int count = 0;


char buffer[SIZE];

jtask* localyou(int c, char *s) {

    FILE* pic_file = fopen("/Users/ethanbreit/leonard.png", "r");

    if(pic_file == NULL) {
	printf("Failed to open file\n");
	fflush(stdout);
    }
    
    fseek(pic_file, 0L, SEEK_END);
    int file_size = ftell(pic_file);
    fseek(pic_file, 0L, SEEK_SET);    
    
    fread(buffer, file_size, 1, pic_file);

    printf("Read file: %d\n", file_size);
    fflush(stdout);


    // Hack as we only support sending strings right now.
    for(int i = 0; i < file_size; i++) {
	if(buffer[i] == 0) {
	    buffer[i] = 1;
	}
    }

    // Null terminated byte array... lol
    buffer[file_size/4] = '\0';
    
    while(1) {
        qqqq.write(buffer);
	count++;
	jsleep(100);
    }
}

jtask* localme(int c, char *s) {
    struct __xx q = {.yy=2, .zz=2.3};
    while(1) {
        jsleep(1000000);
        printf("Sent %d\n", count);
	count = 0;
	fflush(stdout);
    }
}

int main(int argc, char *argv[])
{
    localme(10, "pushing data to qq");
    localyou(10, "pushing data to ppp");
    return 0;
}
