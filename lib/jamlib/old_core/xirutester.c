#include "jparser.h"
#include "json.h"

#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdbool.h>
#include <time.h>
#include <math.h>

#define TOTAL_VALUES						5000
#define MAX_PROPERTIES						1000
#define MAX_LENGTH							200
#define INTERVAL							100
#define	OBJECT_NAME							85

char ** list; // This the array of values we are going to keep about
int * type;
char ** path;
int size;          // How many JSON values there are
int len;


/* These functions below generate a very random JSONValue
 * Must seed the random number first
 */
char * generate_obj(int size);
char * generate_array(int size);

char * generate_undefined(){
	list[size] = (char *)calloc(10, sizeof(char));
	strcpy(list[size], "undefined\0");
	type[size] = UNDEFINED;
	return list[size++];
}

char * generate_integer(){
	int i;
	int length = rand() % 30 + 2;
	list[size] = (char *) calloc(length + 2, sizeof(char));
	
	if(rand() % 2 == 0){
		i = 1;
		list[size][0] = rand() % 8 + '1';
	}
	else{
		i = 2;
		list[size][0] = '-';
		list[size][1] = rand() % 8 + '1';
	}

	for(i; i < length; i++){
		list[size][i] = rand() % 9 + '0';
	}
	list[size][i] = '\0';
	len = length;
	type[size] = INTEGER;
	return list[size++];
}

char * generate_double(){
	int i;
	int length1 = rand() % 25 + 2;
	int length2 = rand() % 25 + 2;
	list[size] = (char *) malloc((length1 + length2) * sizeof(char) + 1);

	if(rand() % 2 == 0){
		i = 1;
		list[size][0] = rand() % 8 + '1';
	}
	else{
		i = 2;
		list[size][0] = '-';
		list[size][1] = rand() % 8 + '1';
	}
	for(i; i < length1; i++)
		list[size][i] = rand() %9 + '0';
	list[size][i] = '.';
	i++;
	for(i; i < length2 + length1; i++)
		list[size][i] = rand() %9 + '0';
	list[size][i] = '\0';
	len = length1 + length2;
	type[size] = DOUBLE;
	return list[size++];
}

char * generate_string(int t){
	int i;
	int length = rand() % 50 + 2;
	list[size] = (char *) calloc((length + 3) , sizeof(char));
	for(i = 1; i < length; i++){
				list[size][i] = rand() %91 + '#';
	}
	list[size][0] = '"';
	list[size][i] = '"';
	list[size][i + 1] = '\0';
	len = length;
	type[size] = t;
	return list[size++];
}

char * generate_bool(){
	if(rand() % 2 == 0){
		list[size] = (char *)calloc(1, sizeof(char) * 5);
		strcpy(list[size], "true");
		len = 5;
		type[size] = JTRUE;
	}
	else{
		list[size] = (char *)calloc(1, sizeof(char) * 6);
		strcpy(list[size], "false");
		len = 6;
		type[size] = JFALSE;
	}
	return list[size++];
}

char * generate_null(){
	list[size] = (char *)calloc(1, sizeof(char) * 5);
	strcpy(list[size], "null");
	len = 5;
	type[size] = JNULL;
	return list[size++];
}


char * generate_array(int units){
	//Size is the number of units we need
	//This is assumed to be even
	int i;
	int partition;
	int length = 0;
	if(units <= 0)
		return NULL;
	char ** array = (char **)calloc(units, sizeof(char *));
	for(i = 0; i < units; i ++){
		switch(rand() % 8){
			case 0: //NULL
				array[i] = generate_null();
				break;
			case 1: 
				array[i] = generate_integer();
				break;//integer
			case 2: 
				array[i] = generate_double();
				break;
			case 3:
				array[i] = generate_bool();	
				break; 
			case 4:
				array[i] = generate_string(STRING);
				break; 
			case 5:
				array[i] = generate_undefined();	
				break;
			case 6: //Another array
				partition = rand() % (units - i) - 1;
				if(partition <= 0)
					partition = 1;
				array[i] = generate_array(partition);
				i += partition;
				break;
			case 7:
				if( (units - i)/2 <= 1){
					i--;
					continue;
				}
				partition = rand() % ((units - i)/2) - 1;
				if(partition <= 0)
					partition = 1;
				array[i] = generate_obj(partition);
				i += partition * 2;
				break;
			default: break;
		}
		//length += len;
	}
	
	for(i = 0; i < units; i++)
		if(array[i] != NULL)
			length += strlen(array[i]);

	list[size] = (char *)calloc( length + 2 * units + 2, sizeof(char));

	int index = 1;
	list[size][0] = '[';

	for(i = 0; i < units; i++)
		if(array[i] != NULL)
			index += sprintf(list[size] + index, "%s, ", array[i]);
	
	
	list[size][index - 2] = ']';
	//index--;
	list[size][index - 1] = '\0';
	free(array);
	//len = index;
	type[size] = ARRAY;
	return list[size++];
}

char * generate_obj(int properties){
	//how many properties we need

	int i;
	int partition;
	int length = 0;
	int index = 0;
	if(properties <= 0)
		return NULL;


	char ** array = (char **)calloc(properties * 2, sizeof(char *));

	for(i = 0; i < properties * 2; i+=2){
		switch(rand() % 8){
			case 0: //NULL
				array[i] = generate_string(OBJECT_NAME);
				length += len;
				array[i + 1] = generate_null();
				//length += len;
				break;
			case 1: 
				array[i] = generate_string(OBJECT_NAME);
				length += len;
				array[i + 1] = generate_integer();
				//length += len;
				break;//integer
			case 2: 
				array[i] = generate_string(OBJECT_NAME);
				//length += len;
				array[i + 1] = generate_double();
				//length += len;
				break;
			case 3:
				array[i] = generate_string(OBJECT_NAME);
				//length += len;
				array[i + 1] = generate_bool();	
				//length += len;
				break; 
			case 4:
				array[i] = generate_string(OBJECT_NAME);
				//length += len;
				array[i + 1] = generate_string(STRING);	
				//length += len;
				break; 
			case 5:
				array[i] = generate_string(OBJECT_NAME);
				//length += len;
				array[i + 1] = generate_undefined();	
				break;
			case 6: //Another array
				partition = rand() % (2 * properties - i) - 1;
				if(partition % 2 != 0)
					partition--;
				if(partition <= 0)
					partition = 2;
				array[i] = generate_string(OBJECT_NAME);
				//length += len;
				array[i + 1] = generate_array(partition);
				//length += len;
				i += partition;
				break; 
			case 7:
				partition = rand() % (properties - i/2) - 1;
				if(partition <= 0)
					partition = 1;
				array[i] = generate_string(OBJECT_NAME);
				//length += len;
				array[i + 1] = generate_obj(partition);
				i += partition * 2;
				//length += len;
				break;
			default: break;
		}
	}
	
	for(i = 0; i < 2 * properties; i += 2)
		if(array[i] != NULL && array[i+1] != NULL)
			length += strlen(array[i]) + strlen(array[i + 1]);

	list[size] = (char *)calloc((length + 5 * properties + 50), sizeof(char));
	index += sprintf(list[size] + index, "{\n");

	for(i = 0; i < 2 * properties; i += 2){
		if(array[i] != NULL && array[i+1] != NULL){
			index += sprintf(list[size] + index, "%s : %s,\n", array[i], array[i+1]);
			//printf("%s : %s \n", array[i], array[i+1]);
		}
	}

	if(index > 2){
		list[size][index - 2] = '\n';
		list[size][index - 1] = '}';
		list[size][index] = '\0';
	}
	//printf("%d, %d, %d\n", length, (length + 5 * properties + 50), strlen(list[size]));
	//if( length + 5 * properties + 2 < strlen(list[size]))
		//printf("\n---------------_EPIC FAILURE---------------\n");
	free(array);
	len = index;
	type[size] = OBJECT;
	return list[size++];
}


int test_object_value(JSONObject * val, char ** list){
	//
	//printf("Number :%d, Count: %d\n", val->allocednum, val->count);
	//for(int i = 0; i < val->count; i++){
	//}
}

int free_list(){
	int i;
	for(i = 0; i < size; i++){
		
		if(list[i] != NULL){
			//printf("%p, %d\n", list[i], type[i]);
			free(list[i]);
			list[i] = NULL;
			type[i] = 0;
		}
	}
	size = 0;
}

int main(void)
{
	int i;
	int totalError = 0;
	int testFail = 0;
	int errors[INTERVAL];
	JSONObject * testVal;

	srand(time(NULL)); //seed random number
	list = (char **)calloc(1000, sizeof(char *)); //Set up the value
	type = (int *)calloc(1000, sizeof(int));
	if(list == NULL){
		printf("Memory Allocation Failure\n");
		exit(1);
	}

		
	for(i = 0; i < 200; i++){
		//generate_obj(rand()%100 + 1);
		
		init_parse(generate_obj(rand()%100 + 1));
		printf("%s\n", list[size-1]);
		
		//printf("LIFE\n");
		printf("\n----------------------------------\n");
		printf("%d\n", i);
		
		if(parse_object() == ERROR){
			totalError += 1;
			printf("ERROR DETECTED, no printing executed...\n");
		}
		else
			print_value(get_value());
		printf("\n----------------------------------\n");
		test_object_value(get_value()->val.oval, list);
		free_list();
		free(get_value());
	}
	free(list);
	free(type);
	
	printf("Total Error %d\nTests Failed %d\n", totalError, testFail);

	printf("%d\n", strlen(generate_undefined()));
}