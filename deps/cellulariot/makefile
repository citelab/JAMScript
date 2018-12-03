#==================================================================#
# @description: makefile for compiling sensor modules
# @author: Matthew L-K matthew.lesko-krlez@mail.mcgill.ca
# 
# Modification Log:
# Date                  Author                  Modification
# -----------------------------------------------------------------
# 23-Oct-2018           Matthew L-K             Created the file
# 31-Oct-2018           Samuel G                Added cellulariot-related tasks. Removed other tasks
# 12-Nov-2018           Samuel G                Added GPS
# 03-Dec-2018			Samuel G				Added test
#==================================================================#

# Define required macros here
CC = gcc
AR = ar rcs
DIR_SRC = ./src/
DIR_TEST = ./test/
DIR_TARGET = ./target/
VPATH = DIR_SRC:DIR_TEST:DIR_TARGET
CFLAG = -Wall -I$(DIR_SRC) -I$(DIR_TEST) -I$(DIR_TARGET)

.PHONY : all run-test clean-obj clean-test clean-all

# Define targets here
all :
	clean-all
	cellulariot
	test
	run-test
	clean-obj
	clean-test

run-test : test
	./test

test : cellulariot.a cellulariot.h
	${CC} ${CFLAG} $? -o ${DIR_TARGET}$@

cellulariot.a : cellulariot.o SDL_Pi_HDC1000.o MMA8452Q.o Adafruit_ADS1x15.o GPS.o
	${AR} ${CFLAG} $? -o ${DIR_TARGET}$@

cellulariot.o : ${DIR_SRC}cellulariot.c SDL_Pi_HDC1000.h MMA8452Q.h Adafruit_ADS1x15.h
	${CC} -c ${CFLAG} $? -o ${DIR_TARGET}$@

%.o : ${DIR_SRC}%.c
	${CC} -c ${CFLAG} ${LIBS} $< -o ${DIR_TARGET}$@

clean-obj :
	rm -f ${DIR_TARGET}*.o

clean-test :
	rm -f ${DIR_TARGET}test

clean-all : 
	 rm -f ${DIR_TARGET}*

