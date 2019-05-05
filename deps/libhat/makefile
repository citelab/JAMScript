#==================================================================#
# @description: makefile for compiling sensor modules
# @author: Matthew L-K matthew.lesko-krlez@mail.mcgill.ca
# 
# Modification Log:
# Date                  Author                  Modification
# -----------------------------------------------------------------
# 23-Oct-2018           Matthew L-K             Created the file
# 31-Oct-2018           Samuel G                Added libhat-related tasks. Removed other tasks
# 12-Nov-2018           Samuel G                Added GPS
# 03-Dec-2018			Samuel G				Added test
#==================================================================#

# Define required macros here
CC = gcc
AR = ar rcs
DIR_SRC = ./src/
DIR_TEST = ./test/
DIR_TARGET = ./target/
VPATH = $(DIR_SRC):$(DIR_TEST):$(DIR_TARGET)
CFLAG = -Wall -I$(DIR_SRC) -I$(DIR_TEST) -I$(DIR_TARGET)

.PHONY : all run-test clean-obj clean-test clean-all

# Define targets here
all : clean-all libhat.a test run-test clean-obj clean-test

run-test : test
	$(DIR_TARGET)test

test : testlibhat.c libhat.a libhat.h
	$(CC) $(CFLAG) $(DIR_TEST)testlibhat.c $(DIR_TARGET)libhat.a $(DIR_SRC)libhat.h -o $(DIR_TARGET)$@
	chmod 777 $(DIR_TARGET)$@

libhat.a : libhat.o SDL_Pi_HDC1000.o MMA8452Q.o Adafruit_ADS1015.o 
	$(AR) $(DIR_TARGET)$@ $(DIR_TARGET)libhat.o $(DIR_TARGET)SDL_Pi_HDC1000.o $(DIR_TARGET)MMA8452Q.o $(DIR_TARGET)Adafruit_ADS1015.o

libhat.o : libhat.c SDL_Pi_HDC1000.h MMA8452Q.h Adafruit_ADS1015.h
	$(CC) -c $(CFLAG) $< -o $(DIR_TARGET)$@

%.o : $(DIR_SRC)%.c
	$(CC) -c $(CFLAG) $< -o $(DIR_TARGET)$@

libhat.so : libhat.o SDL_Pi_HDC1000.o MMA8452Q.o Adafruit_ADS1015.o
	$(CC) -shared -o $(DIR_TARGET)libhat.so $(DIR_TARGET)libhat.o $(DIR_TARGET)Adafruit_ADS1015.o $(DIR_TARGET)MMA8452Q.o $(DIR_TARGET)SDL_Pi_HDC1000.o

clean-obj :
	rm -f $(DIR_TARGET)*.o

clean-test :
	rm -f $(DIR_TARGET)test

clean-all : 
	 rm -f $(DIR_TARGET)*

