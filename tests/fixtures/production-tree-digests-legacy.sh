#!/bin/bash
# Frozen digest-format oracle from aecbd9e51e76096287cedba26c8c4c8e34c26fe9.
tree_sha256() {
    local root="$1"
    local relative file_sha file_size
    (
        cd "$root"
        while IFS= read -r -d '' relative; do
            relative="${relative#./}"
            file_sha="$(sha256sum -- "$relative" | awk '{print $1}')"
            file_size="$(stat -c '%s' -- "$relative")"
            printf '%s\0%s\0%s\n' "$relative" "$file_size" "$file_sha"
        done < <(find . -xdev -type f -print0 | LC_ALL=C sort -z)
    ) | sha256sum | awk '{print $1}'
}

portable_tree_sha256() {
    local root="$1"
    local mode="${2:-full}"
    local relative entry_type entry_mode entry_size entry_sha
    [[ "$mode" == "full" || "$mode" == "static" ]] || return 1
    (
        cd "$root"
        if [[ "$mode" == "static" ]]; then
            while IFS= read -r -d '' relative; do
                relative="${relative#./}"
                [[ -n "$relative" ]] || relative='.'
                if [[ -d "$relative" ]]; then
                    entry_type='d'; entry_size='0'; entry_sha='-'
                else
                    entry_type='f'
                    entry_size="$(stat -c '%s' -- "$relative")"
                    entry_sha="$(sha256sum -- "$relative" | awk '{print $1}')"
                fi
                entry_mode="$(stat -c '%a' -- "$relative")"
                printf '%s\0%s\0%s\0%s\0%s\n' \
                    "$relative" "$entry_type" "$entry_mode" "$entry_size" "$entry_sha"
            done < <(find . -xdev \
                \( -path './data/user_drive_discs.json' \
                    -o -path './data/scan-telemetry' \
                    -o -path './data/scan-telemetry/*' \) -prune \
                -o \( -type d -o -type f \) -print0 | LC_ALL=C sort -z)
        else
            while IFS= read -r -d '' relative; do
                relative="${relative#./}"
                [[ -n "$relative" ]] || relative='.'
                if [[ -d "$relative" ]]; then
                    entry_type='d'; entry_size='0'; entry_sha='-'
                else
                    entry_type='f'
                    entry_size="$(stat -c '%s' -- "$relative")"
                    entry_sha="$(sha256sum -- "$relative" | awk '{print $1}')"
                fi
                entry_mode="$(stat -c '%a' -- "$relative")"
                printf '%s\0%s\0%s\0%s\0%s\n' \
                    "$relative" "$entry_type" "$entry_mode" "$entry_size" "$entry_sha"
            done < <(find . -xdev \( -type d -o -type f \) -print0 | LC_ALL=C sort -z)
        fi
    ) | sha256sum | awk '{print $1}'
}
