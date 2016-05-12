#include <stdio.h>
#include <stdlib.h>
#include <string.h>

jsync void createDB() {
	var a;
	users = [];
}

jsync int createUser(char * name, char * password) {
	var a;
	if(users.indexOf(name) > -1) {
		return 0;
	}

	users[name] = password;
	return 1;
}


jsync int jlogin(char * name, char * password) {
	var a;
	if(users[name] == password) {
		return 1;
	} else {
		return 0;
	}
}

void addUser() {
	char *name = NULL;
	char *password = NULL;
	size_t size;
	int ret; 

	printf("User Name: ");
	getline(&name, &size, stdin);
	name[strlen(name)-1] = 0;
	
	printf("Password: ");
	getline(&password, &size, stdin);
	password[strlen(password)-1] = 0;

	if(createUser(name, password) == 1) {
		printf("\nUser added\n");
	} else {
		printf("\nFailed to add new user\n");
	}
}

void login() {
	char *name = NULL;
	char *password = NULL;
	size_t size;

	printf("User Name: ");
	getline(&name, &size, stdin);
	name[strlen(name)-1] = 0;
	
	printf("Password: ");
	getline(&password, &size, stdin);
	password[strlen(password)-1] = 0;
	
	if(jlogin(name, password) == 1) {
		printf("\nLogged in\n");
	} else {
		printf("\nLogin failed\n");
	}
}


int main() {
	int code;
    int loop = 1;
    createDB();

    while(loop) {
        printf("Your choice: \n \
                1 - Add User \n \
                2 - Login \n");

        scanf("%d%*c", &code);
        switch (code) {
            case 1:
                addUser();
                break;
            case 2:
                login();
                break;
            case 3:
                loop = 0;
                break;
        }
    }
	
	return 0;
}