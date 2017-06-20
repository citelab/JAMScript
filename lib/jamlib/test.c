#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdint.h>
#include <cbor.h>

#include "command.h"
#include "cborutils.h"
#include "free_list.h"

//fmt - string: format string such as "%s%d%f"
//args followed fmt will be paired up. For example, 
//parseCmd("%s%d", "person", "Lilly", "age", 19) indicates the variable named "person"
//is expected to have a string type value followed, which is "Lilly" in this case 
cbor_item_t* parseCmd(char *fmt, ...){
	int i, num = strlen(fmt);
	if(num==0){
		printf("Invalid format string\n");
		return NULL;
	}

	//root   - cbor map: object contains encoded info about input args
	//value  - cbor map: object contains encoded info about an input argu
	//content- encoded primitive type: argument's content 
	//key    - encoded string: argument's name
	//type   - encoded string: argument's type ("string", "int" or "double")
	cbor_item_t *root, *value, *content, *key, *type;
	//initialize root
	if((root = cbor_new_indefinite_map()) == NULL){
		printf("Failure on malloc for new cbor map\n");
		return NULL;
	}

    //initialize args to be used by va_end and va_arg
    //fmt is the last fixed argument before the ellipsis
    va_list args;
    va_start(args, fmt);

	//fmt_str is in the format such as %s%d%c
	for(i=0;i<strlen(fmt)-1;i=i+2){
		if(fmt[i]!='%'){
			printf("Invalid format string\n");
			return NULL;
		}
		//key is the name of this argument
		key = cbor_build_string(strdup(va_arg(args, char *)));
		//(re)initialize value cbor map
		if((value = cbor_new_definite_map(2)) == NULL){
			printf("Failure on malloc for new cbor map\n");
			return NULL;
		}
		switch(fmt[i+1]){
			case 's':	//string
				type = cbor_build_string("string");				
				content = cbor_build_string(strdup(va_arg(args, char *)));
				break;
			case 'i':	//int
				//fall through
			case 'd':	//int
				type = cbor_build_string("int");
				content = cbor_build_uint32(abs(va_arg(args, int)));
				break;
			case 'f':	//float
				type = cbor_build_string("double");
				content = cbor_build_float8(va_arg(args, double));
				break;
			default:
				printf("Invalid format string\n");
				return NULL;
		}
		cbor_map_add(value, (struct cbor_pair){
			.key = cbor_build_string("type"),
			.value = type	
		});
		cbor_map_add(value, (struct cbor_pair){
			.key = cbor_build_string("content"),
			.value = content
		});	
		cbor_map_add(root, (struct cbor_pair){
			.key = key,
			.value = value
		});				
	}
	va_end(args);
	return root;
}


int main(){
	cbor_item_t *cbor_obj = parseCmd("%s%s%d%i%f",
		"name", "Lilly", 
		"info","birthday", 
		"year", 1997,
		"month",9,
		"date", 20.0
	);
	cbor_mutable_data buffer;
	size_t buffer_size;
	cbor_serialize_alloc(cbor_obj, &buffer, &buffer_size);
	printf("buffer_size %d\n", buffer_size);
	if(cbor_obj == NULL) printf("Fail\n");
}