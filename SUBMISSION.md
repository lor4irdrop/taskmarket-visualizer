# SUBMISSION — TSK-BRK611AN — Build and host Taskmarket's live market visualizer

- **Status:** SUBMIT BERHASIL 25 Nov 2026 ~02:52 WIB
- **Submission ID:** b5ead0df-e470-4ef7-928e-b56e43722066
- **Idempotency key:** 0530ee7a-bf59-4d39-be02-7bb8d8e85b49
- **Tx submit:** 0x06e130095ccca8ccfae5e020ae313a0280cde4882b5ed7c006452fe2a22db34e
- **Biaya:** 0 OUSD (GRATIS — worker submit requiresPayment false, terverifikasi live sebelum submit)
- **Posisi:** entry ke-~15 (0 subs saat ditemukan 01:57 WIB; 14 subs saat submit 02:52 WIB — kompetitor bergerak cepat)
- **Hadiah:** $50, top 3 split 35/10/5; syarat bayar: lolos semua cek Part 1 + skor ≥60 + tanpa nilai 1; requester cek situs 3 hari berbeda; tutup 1 Des 18:52 UTC, keputusan ≤8 Des 2026
- **Entry:** notes.txt (live URL + repo URL + stack + endpoint + refresh + deploy command)
- **Live URL:** https://lor4irdrop.github.io/taskmarket-visualizer/
- **Repo URL:** https://github.com/lor4irdrop/taskmarket-visualizer (public, MIT)
- **Review kedua:** Groq gpt-oss-20b — verdict SUBMIT (notes.txt + checklist Part 1).
- **Koreksi QC sebelum submit (temuan verifikasi mandiri, BUKAN dari subagent):**
  1. notes.txt + README + meta.json + app.js sempat mengklaim refresh "GitHub Actions, hourly" — SALAH: token PAT hanya scope public_repo, file .github/workflows/* ditolak GitHub 404, jadi Actions TIDAK berjalan. Semua klaim diperbaiki jadi "scheduled server-side fetch, at least hourly, from the operator's server" (fetch-data.mjs + upload via Contents API). File workflow disertakan sebagai referensi di docs/workflows/.
  2. deploy.sh sempat `git push origin main` di direktori BUKAN git repo — TIDAK BISA jalan. Ditulis ulang jadi: fetch data + regenerate og + upload via gh.py (terverifikasi jalan: 25 file, deploy sukses).
  3. Spot-check angka vs API live (snapshot 02:48:29 WIB): 5/6 headline cocok persis (activeAgents7d 473, paidWorkers 158, activeWallets 930, activeWorkers7d 511, registeredWorkers 148418); openTasks 91 vs 90 = drift live setelah snapshot, tercakup "data as of".
- **Verifikasi:** my-submissions 124 → 125 (76 open, 49 completed), submittedAt 2026-11-24T19:52:41Z, taskStatus open, rejectedAt null. Live: index 200, data/*.json 200, meta.json fetchedAtWIB 2026-11-25 02:48:29 WIB, notes.txt + README sudah versi terkoreksi.
- **REFRESH BERJALAN (penting — syarat lolos Part 1):** data harus segar ≥1x/jam. Mekanisme saat ini: tiap run taskmarket-watch menjalankan `cd ~/workspace/taskmarket-tempo-tasks/brk611an-visualizer && ./deploy.sh` (fetch + upload, ~1 menit). JANGAN lupa — kalau data basi >1 hari saat requester cek, entry gagal cek Part 1. Alternatif permanen: tambah 2 file workflow via GitHub web UI (butuh login GitHub Ndan — JANGAN tanpa izin) atau token dengan scope workflow.
- **Catatan teknis:** subagent build selesai 02:44 WIB (laporan lengkap di handoff); gh.py get_sha mencetak body 404 ke stderr untuk file baru — harmless.
