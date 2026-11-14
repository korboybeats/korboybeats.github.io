#!/usr/bin/env bash
# Add .deb packages to this APT repo and regenerate Packages / Packages.gz.
#
#   ./add-package.sh path/to/a.deb [more.deb ...]   copy into debs/ and index
#   ./add-package.sh --rebuild                      re-index everything in debs/
#
# An existing entry with the same Package + Version + Architecture is replaced.
# Index-only fields (Depiction, Sileodepiction, Summary...) carry over from the
# old entry for that version, else from the newest entry for that package.
# Does not commit or push.
set -euo pipefail
cd "$(dirname "$0")"

entry() {  # print one Packages stanza for debs/<file>; $2 = old index to carry repo-only fields from
    local f=$1 old=${2:-/dev/null}
    { dpkg-deb -f "$f"; echo "--OLD--"; cat "$old"; } | awk -v fn="$f" \
        -v p="$(dpkg-deb -f "$f" Package)" -v v="$(dpkg-deb -f "$f" Version)" -v a="$(dpkg-deb -f "$f" Architecture)" \
        -v sz="$(stat -c%s "$f")" \
        -v md5="$(md5sum "$f" | cut -d' ' -f1)" \
        -v s1="$(sha1sum "$f" | cut -d' ' -f1)" \
        -v s256="$(sha256sum "$f" | cut -d' ' -f1)" '
        function name(line) { return tolower(substr(line, 1, index(line, ":") - 1)) }
        # Stanza boundary in the old index: remember the exact match, else the last one for this package.
        function close_old() {
            if (hp && hv && ha) exact = cur
            else if (hp) latest = cur
            cur = ""; hp = hv = ha = 0
        }
        $0 == "--OLD--" { old = 1; next }
        !old {
            ctl[++nc] = $0
            if ($0 !~ /^[ \t]/) have[name($0)] = 1
            next
        }
        $0 == "" { close_old(); next }
        {
            cur = cur $0 "\n"
            if ($0 == "Package: " p) hp = 1
            if ($0 == "Version: " v) hv = 1
            if ($0 == "Architecture: " a) ha = 1
        }
        END {
            close_old()
            src = exact != "" ? exact : latest
            have["filename"] = have["size"] = have["md5sum"] = have["sha1"] = have["sha256"] = 1
            # Fields the index had but the deb control lacks (Depiction, Sileodepiction, Summary...).
            n = split(src, l, "\n"); keep = 0
            for (i = 1; i <= n; i++) {
                if (l[i] == "") continue
                if (l[i] !~ /^[ \t]/) keep = !(name(l[i]) in have)
                if (keep) extra = extra l[i] "\n"
            }
            for (i = 1; i <= nc; i++) {
                print ctl[i]
                if (ctl[i] ~ /^Installed-Size:/) { meta(); done = 1 }
            }
            if (!done) meta()
            printf "%s", extra
        }
        function meta() {
            print "Filename: " fn; print "Size: " sz
            print "MD5sum: " md5; print "SHA1: " s1; print "SHA256: " s256
        }'
    echo
}

key() { echo "$(dpkg-deb -f "$1" Package)|$(dpkg-deb -f "$1" Version)|$(dpkg-deb -f "$1" Architecture)"; }

finish() {
    gzip -9nkf Packages
    echo "Packages: $(grep -c '^Package:' Packages) entries"
}

if [ "${1:-}" = --rebuild ]; then
    touch Packages
    : > Packages.new
    for f in debs/*.deb; do entry "$f" Packages >> Packages.new; done
    mv Packages.new Packages
    finish
    exit
fi

[ $# -gt 0 ] || { sed -n '2,10p' "$0"; exit 1; }
for d in "$@"; do
    [ -f "$d" ] || { echo "not found: $d" >&2; exit 1; }
    dpkg-deb -f "$d" Package >/dev/null || { echo "not a deb: $d" >&2; exit 1; }
done

touch Packages
for d in "$@"; do
    f="debs/$(basename "$d")"
    [ "$(realpath "$d")" = "$(realpath -m "$f")" ] || cp "$d" "$f"
    IFS='|' read -r pkg ver arch <<< "$(key "$f")"
    # Drop any stanza with the same Package/Version/Architecture, then append.
    awk -v RS= -v ORS='\n\n' -v p="$pkg" -v v="$ver" -v a="$arch" '
        {
            hp = hv = ha = 0
            n = split($0, l, "\n")
            for (i = 1; i <= n; i++) {
                if (l[i] == "Package: " p) hp = 1
                if (l[i] == "Version: " v) hv = 1
                if (l[i] == "Architecture: " a) ha = 1
            }
            if (!(hp && hv && ha)) print
        }' Packages > Packages.new
    entry "$f" Packages >> Packages.new
    mv Packages.new Packages
    echo "added $pkg $ver $arch"
done
finish
