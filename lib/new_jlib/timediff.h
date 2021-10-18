#pragma once
struct timespec timespec_sub(struct timespec a, struct timespec b);
void PrintTimeWith(struct timespec tr, const char* format, ...);