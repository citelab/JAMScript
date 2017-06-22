#include "encoding.h"
//fmt - string: format string such as "%s%d%f"
//args followed fmt will be paired up. For example, 
//parseCmd("%s%d", "person", "Lilly", "age", 19) indicates the variable named "person"
//is expected to have a string type value followed, which is "Lilly" in this case 
char* jamdata_encode(char *fmt, ...){
	// encoded_obj err;
	// err.data = NULL;
	// err.size = 0;

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
	cbor_item_t *root, *content, *key; //*type, *value;
	//initialize root
	if((root = cbor_new_indefinite_map()) == NULL){
		printf("Failure on malloc for new cbor map\n");
		return NULL;
	}

    //initialize args to be used by va_end and va_arg
    //fmt is the last fixed argument before the ellipsis
    va_list args;
    va_start(args, fmt);

	//fmt_str is in the format such as sdf
	for(i=0;i<strlen(fmt);i++){
		//key is the name of this argument
		key = cbor_build_string(strdup(va_arg(args, char *)));
		//(re)initialize value cbor map
		// if((value = cbor_new_definite_map(2)) == NULL){
		// 	printf("Failure on malloc for new cbor map\n");
		// 	return err;
		// }
		switch(fmt[i]){
			case 's':	//string
				//type = cbor_build_string("string");				
				content = cbor_build_string(strdup(va_arg(args, char *)));
				break;
			case 'i':	//int
				//fall through
			case 'd':	//int
				//type = cbor_build_string("int");
				content = cbor_build_uint32(abs(va_arg(args, int)));
				break;
			case 'f':	//float
				//type = cbor_build_string("double");
				content = cbor_build_float8(va_arg(args, double));
				break;
			default:
				printf("Invalid format string\n");
				return NULL;
		}
		// cbor_map_add(value, (struct cbor_pair){
		// 	.key = cbor_build_string("type"),
		// 	.value = type	
		// });
		// cbor_map_add(value, (struct cbor_pair){
		// 	.key = cbor_build_string("content"),
		// 	.value = content
		// });	
		cbor_map_add(root, (struct cbor_pair){
			.key = key,
			.value = content
		});				
	}	
	// printf("size %d\n", cbor_map_size(root));
	va_end(args);
	unsigned char *buffer; 
	size_t        buffer_size;
	cbor_serialize_alloc(root, &buffer, &buffer_size);
	// printf("buffer size: %d\n", buffer_size);
	// printf("buffer: %s\n", buffer);
	return buffer;
	// return (struct encoded_obj){
	// 	.data = buffer,
	// 	.size = buffer_size
	// };
}

// data          - encoded cbor data to be decoded
// num	         - # field in data
// buffer        - a pointer to the c struct stores decoded data
// args followed - offset of each field in data
void* jamdata_decode(unsigned char *data, int num, void *buffer, ...){
	// memcpy each field value in data to the corresponding field in buffer
	struct cbor_load_result result;
	// printf("%d\n", sizeof(struct cbor_pair));
	cbor_item_t *obj = cbor_load(data, 100, &result);
	// printf("%d\n", cbor_map_size(obj));
	struct cbor_pair *handle = cbor_map_handle(obj);
	int i;
	char *buf = (char *)malloc(100); 
	for(i=0;i<num;i++){
		cbor_serialize_string(handle[i].key, buf, 100);
		printf("%s\n", buf);
	}
	cbor_serialize_string(handle[1].value, buf, 100);
	printf("%s\n", buf);
	free(buf);
	
    // buffer = malloc(sizeof(data));
	// return buffer pointer
}

int main(){
	unsigned char *encode = jamdata_encode("ssdif",
		"name", "Lilly", 
		"info","birthday", 
		"year", 1997,
		"month",9,
		"date", 20.0
	);
	
	jamdata_decode(encode, 5, NULL);
	// struct cbor_load_result result;
	// cbor_item_t *obj = cbor_load(encode, 100, &result);
	// printf("%d\n", cbor_map_size(obj));
	//jamdata_log_to_server("global", "s", jamdata_encode("if", "y", i, "f", i+0.1), ((void*)0));
}

