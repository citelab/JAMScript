#!/bin/bash
for DOTFILE in $(find -name "*.dot"); do
    OUTFILE=$(echo "$DOTFILE" | sed -e 's/dot$/pdf/')
    dot -Tpdf $DOTFILE -o $OUTFILE
done
