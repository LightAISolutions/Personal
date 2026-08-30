# Project Architecture

> **Scope** — this document covers the repo-wide architecture: how environments connect to each other and to shared infrastructure (CI/CD, GitHub Pages, templates, versioning, developer tools). It does **not** cover the internal processes of individual environments (auto-refresh polling, GAS self-update loops, page lifecycle states, etc.) — those are documented in per-environment diagrams under `repository-information/diagrams/`.

## 1. Flowchart — System Overview

> [Open in mermaid.live — Flowchart](https://mermaid.live/edit#pako:eNq1Wf1u28gRf5UFDzgk11Bycpfc2cC1oClaUk3bgkinDUxDWJEjcuMVl9hd2tHFAfoQfZf-30fpkxS7_BAlkjolverP5cxvvmdnVp-NkEVgnBkxx1mC_PMgRQghkS-Lg8CYQ8YEkYxvztAMuGAppoFRkKlfRDiEkrBUM2_PGxAjeATKMuDob4w_rCh7agKo38h5f9ekGyKb4jwCZLMIAuN-l9o-vwuMUBMMf0BLjtMwaRGNnPfINP_8HBhZLpLAeEb2-ZYC0qhHWXs6tEfoP__4J8K5ZOYaeAxmIWywWVN0J2GdUSwB_ftfiKREEkzJbxDd79u065jmF38-HY-d-efAmOUiQZKhypi_BMaXfVuVFRVLJ4428wOIZ-RNrIU9cezLz4Fhs_WaSHUUBOmviGIhzYyzEISAqC2nZt2ijRzX8Z2F51uuo6NDQQIiaQKcSIgqxwfpC_FAMqQ99bIVh13ga_aM3lvudGT5zufA8IA_QoRImgI3RchJJoMgFZtU4k_oEVPSoWnFXuOduzf25V1gXGBCEc9THbwlZeFDEKRaK_Q9iiCjbKOULdRGGQehpbdV3pGgXXHlzMfKB1cajaSSoTUmaYtT0-mA3c4UwsKbWHeBcZtFWEIQpLtRMEMdo4FIcAtpy6_hRtOLi7vAsBMIH1BMJIrIatXO-enFRZn0lDyCKYgEM8MxiCEKE5zGEKlCmFljx1tcuNb4LjD0Z7P8in5FkudwCHgQiybW2PIWI2fm3nzQKaKcrM7QI8EozDlFsxvPb-FtuQrrikw7n_d5sybY5uHv1f_WyBJBSVvo0_4qCoyRrlqUlYVZRPm5h72_i4yJnORLNFPORYVb1pDKdt_bwm7914qdZEGQNiFb1rrT9yo_XfIIyCNFrpE4kZgIRnPVhcQgJjLJlwPChts-ft-vj3abwj3GXid9JJylykaBXmgdX_Y3RHfeSgd_5mqxd4FRd9h7FGOhyuUjhNIMOWDJ-CCRa6rqWGXZrPiG7OJbu5R9x_OtW38ytrzXHfgShMS5TGIsXtfAPgiJrFwm6HU_4MS_cg8hKrAuSMXXhTt2b84t17I7vUDZElMc0q3t-gRZttul4d99--ZqZs2dTv0-SdV3Msyhod4nieziEPmM0TbqleX5zrxbvyssJHDLdmvA-mQX6EC9MBZTQFaWCeTpe0Bsb9r7r8qkRTPmB8Idi862tBPgQ7Hd4--3zUswhwjNQbCch_Bthl3f_NW5_OC6uxoNUvYRHja0Xcne9WiXVLA8jcSwRajsXLx35t4uubLRfAQuVOtoc429Dp5YHODQcmy3Q0pxm1AWd8vZ54lFL0d_DPZbagUnhscPdKpFXd-o3NhVaCLX1EqjMRZ-eWblkhV3vpkylTG6MAbyk5puXugWUAt9IjJhuVTTZtJRzDN38ZUSj5CHynLrlll246vpdae5qievSUrWmJbWmdVHUy0Tg4-ikqxadPXtoJzDUo6WURjXtqo_L-oLhKUrEh-oTNu1bkfO4mqvqorjwTpSqpQ3FSKpkDzXdSzaZs9vXWevcAblMMNzCmKooDB9whthUoYjiNCfUIZlYoqQZRAhTdUxaF9OXbcHWDwQSgtkkj6yB7ykgJ7KZQwVXzs0dWY3qsx3MXm9EA7KatehaI-M1nhuXXl9zCZJV4yvsfLSMCI45nhdaJgBN2E7TyDMw4RICGXOAVWUHfY7vj-9Hvd5AKQkaSwGHwVLlRQ1RP9Q7HiYUvbUtQio3eVi6u5dd-UgNewf5rWbd9ckFOeYR8empSrnCZMPsDmQktbkUhXOTbEqNHVUnWzNIrIiEN1rGwuw4bZNDHDyoN3AAdIVARqhLKfUXGIBUeGWXBPyY3X-_Wt7ej31F549n878vbupYB2q7muqFBkIvVeyFEyRMIlWjD9se7POmc5-svAc_3bWDS5A5pnZmChLIaqBVJW7IhSQHjQ7JdjebDGxvEm3ADVV5apBicxMsEhKfNubqUQy37x9h9QxKugOGFHPgn1jYM_oUs9ofeNZB18jJsgc6BVIBz8CVXECMR4PVUSCIOWQUazmlzdvtKOEflSp-uJeiuzlSnWPVTJClm30w4fytdpWUnjSjRtlxX7z3B7d_2ek7cz-zVC7Y_o3w-xO0wXM3nVYodU1XUyP-rmlI5NfVst4023_F2DtxT8UuXbqH4pa-7iM0n46VbiwXkIk9IMFWXG8hn5PthPpaJCG19ROXfHpJyhRElc78CGynqo4TLyf-D0adOR2H-7uinmItifV6-efMricxDFwgQTQVXnzHMzob-DfTdyvAGjn51cw76VhNVJUrBxwhJYbRV2_lBaUzRfAgvZJDRSiIlUoBWW9wlWE5VyGMkYpSePO9DqGqSfZvoZ1P_WO0rUjEY-T2ZWWx3B2Jel23TvY2IsVqHnZ7CtR_qUiNxT0vxIrQunZdz_h05Po9FXIKONn361WqyaZLqWC7t275fId7qGrs6mghdXbH9-e9NA2n_Nr-lN8WmOfnJw06fWz-jHADUcV1KsV_vnNux7Y-rY8graRtMeQ17NISRzC6Y_RLz3Eeg07hrDYq46hbM5SBfnPv5yenIYNvxmvjDXwNSaRcWZ8DgyZgLorzgIjghXOqQyML8YrPYJ5mzQ0ztRz_CujaCmjYvcpDr_8F8dPmYE) — *interactive editor with pan, zoom, and export*

```mermaid
graph TB
    subgraph "Repository: Personal"
        direction TB

        subgraph "Developer Workflow"
            DEV["Developer / Claude Code"]
            CB["claude/* branch"]
            DEV -->|"push"| CB
        end

        subgraph "CI/CD — auto-merge-claude.yml [template · initialized]"
            direction TB
            TRIGGER{"Push to claude/*?"}
            CB --> TRIGGER
            TRIGGER -->|Yes| SHA_CHECK{"Commit SHA\n= last-processed?"}
            SHA_CHECK -->|Yes| DELETE_STALE["Delete inherited branch\n(skip merge)"]
            SHA_CHECK -->|No| VALIDATE{"Served inner-script\nsyntax valid?"}
            VALIDATE -->|No| BLOCK["Fail run — block\nmerge & deploy\n(branch preserved)"]
            VALIDATE -->|Yes| MERGE["Merge into main"]
            MERGE --> UPDATE_SHA["Update\nlast-processed-commit.sha"]
            UPDATE_SHA --> DIFF["Check git diff"]
            DIFF -->|"live-site-pages/ changed"| PAGES_FLAG["pages-changed = true"]
            DIFF -->|".gs changed"| GAS_DEPLOY["Deploy GAS via curl POST"]
            GAS_DEPLOY --> DELETE_BR
            MERGE --> DELETE_BR["Delete claude/* branch"]
            PAGES_FLAG --> DEPLOY_PAGES
            TRIGGER -->|"Direct push to main"| DEPLOY_PAGES
        end

        subgraph "GitHub Pages Deployment"
            DEPLOY_PAGES["Deploy live-site-pages/ to\nGitHub Pages"]
            LIVE["Live Site\nlightaisolutions.github.io/Personal"]
            DEPLOY_PAGES --> LIVE
        end

        subgraph "Environments (Pages)"
            direction LR
            GASTPL_PAGE["[template] gas-project-creator.html\n(GAS Project Creator)"]
            TESTAUTHGAS1_PAGE["[template] testauthgas1.html\n(Test Auth 1)"]
            TESTAUTHHTML1_PAGE["[template] testauthhtml1.html\n(Test Auth HTML 1)"]
            GLOBALACL_PAGE["[template] globalacl.html\n(Global ACL)"]
            TEXTCOMPARE_PAGE["[template] text-compare.html\n(Text Compare Tool)"]
            MASTERACL_PAGE["[template] MasterACL.html\n(MasterACL)"]
        end

        subgraph "Google Apps Scripts [template]"
            direction LR
            GAS_TESTAUTHGAS1["[template] testauthgas1.gs"]
            GAS_TESTAUTHHTML1["[template] testauthhtml1.gs"]
        end

        subgraph "Shared Resources [template]"
            direction LR
            NOJEKYLL["[template] .nojekyll"]
            SND["[template] sounds/"]
            HTML_VERS["[template] html-versions/"]
            GS_VERS["[template] gs-versions/"]
            HTML_CL["[template] html-changelogs/"]
            GS_CL["[template] gs-changelogs/"]
        end

        subgraph "live-site-pages/templates/ [template · initialized]"
            TPL_NOAUTH["[template] HtmlAndGasTemplateAutoUpdate-noauth.html.txt\n(HTML template without auth)"]
            TPL_AUTH["[template] HtmlAndGasTemplateAutoUpdate-auth.html.txt\n(HTML template with Google auth)"]
            GASTPL_MIN_NOAUTH["[template] gas-minimal-noauth-template-code.js.txt\n(GAS template)"]
            GASTPL_MIN_AUTH["[template] gas-minimal-auth-template-code.js.txt\n(GAS template with auth)"]
        end

        subgraph "Project Config [template]"
            CLAUDE_MD["[template] CLAUDE.md\n(project instructions)"]
            RULES["[template] .claude/rules/\n(always-loaded + path-scoped rules)"]
            SKILLS["[template] .claude/skills/\n(invokable workflow skills)"]
            REPO_VER["[template] repository.version.txt"]
            DIAGRAMS["[template] repository-information/diagrams/\n(per-environment architecture diagrams)"]
            SETTINGS["[template] .claude/settings.json\n(git * auto-allowed)"]
            SHA_FILE["[template] .github/last-processed-commit.sha\n(inherited branch guard)"]
        end

        subgraph "AutoHotkey [template]"
            AHK_AUTOUPDATE["[template · modified] autoHotkey/AutoUpdate.ahk\n(greenfield pull-based auto-updater)"]
        end

        subgraph "Scripts [template]"
            INIT_SCRIPT["[template] scripts/init-repo.sh\n(one-shot fork initialization)"]
            GAS_SETUP["[template] scripts/setup-gas-project.sh\n(GAS project file creation)"]
            CSP_HASH["[template] scripts/compute-csp-hash.sh\n(CSP SHA-256 hash computation)"]
            GAS_GLOBALACL["[template] globalacl.gs"]
            GAS_MASTERACL["[template] MasterACL.gs"]
            INIT_SCRIPT -.->|"auto-detects org/repo\nreplaces 22 files"| CLAUDE_MD
        end
    end

    TPL_AUTH -.->|"copy to create\nnew auth pages"| TESTAUTHGAS1_PAGE
    TPL_AUTH -.->|"copy to create\nnew auth pages"| TESTAUTHHTML1_PAGE
    TPL_AUTH -.->|"copy to create\nnew auth pages"| GLOBALACL_PAGE
    TPL_AUTH -.->|"copy to create\nnew auth pages"| MASTERACL_PAGE
    GASTPL_MIN_AUTH -.->|"template source\n(setup-gas-project.sh)"| GAS_TESTAUTHGAS1
    GASTPL_MIN_AUTH -.->|"template source\n(setup-gas-project.sh)"| GAS_TESTAUTHHTML1
    GASTPL_MIN_AUTH -.->|"template source\n(setup-gas-project.sh)"| GAS_GLOBALACL
    GASTPL_MIN_AUTH -.->|"template source\n(setup-gas-project.sh)"| GAS_MASTERACL
    TESTAUTHGAS1_PAGE -.->|"embeds via iframe"| GAS_TESTAUTHGAS1
    TESTAUTHHTML1_PAGE -.->|"embeds via iframe"| GAS_TESTAUTHHTML1
    LIVE -.->|"serves"| GASTPL_PAGE
    LIVE -.->|"serves"| TESTAUTHGAS1_PAGE
    LIVE -.->|"serves"| TESTAUTHHTML1_PAGE
    LIVE -.->|"serves"| GLOBALACL_PAGE
    LIVE -.->|"serves"| TEXTCOMPARE_PAGE
    LIVE -.->|"serves"| MASTERACL_PAGE
    GAS_DEPLOY -.->|"triggers self-update"| GAS_TESTAUTHGAS1
    GAS_DEPLOY -.->|"triggers self-update"| GAS_TESTAUTHHTML1
    GAS_DEPLOY -.->|"triggers self-update"| GAS_GLOBALACL
    GAS_DEPLOY -.->|"triggers self-update"| GAS_MASTERACL
    SHA_FILE -.->|"read by"| SHA_CHECK
    UPDATE_SHA -.->|"writes"| SHA_FILE
    HTML_VERS -.->|"version polling"| GASTPL_PAGE
    HTML_VERS -.->|"version polling"| TESTAUTHGAS1_PAGE
    HTML_VERS -.->|"version polling"| TESTAUTHHTML1_PAGE
    HTML_VERS -.->|"version polling"| GLOBALACL_PAGE
    HTML_VERS -.->|"version polling"| TEXTCOMPARE_PAGE
    HTML_VERS -.->|"version polling"| MASTERACL_PAGE
    TPL_NOAUTH -.->|"copy to create\nnew noauth pages"| TEXTCOMPARE_PAGE

    style DEV fill:#4a90d9,color:#fff
    style LIVE fill:#66bb6a,color:#fff
    style SHA_FILE fill:#ef5350,color:#fff
    style DELETE_STALE fill:#ef9a9a,color:#000
    style BLOCK fill:#ef5350,color:#fff
    style TPL_NOAUTH fill:#ffa726,color:#000
    style TPL_AUTH fill:#ffa726,color:#000
    style GASTPL_PAGE fill:#ffa726,color:#000
    style CLAUDE_MD fill:#ce93d8,color:#000
    style RULES fill:#ce93d8,color:#000
    style SKILLS fill:#ce93d8,color:#000
    style INIT_SCRIPT fill:#78909c,color:#fff
```

## 2. Sequence Diagram — Deploy & Runtime Flows

> [Open in mermaid.live — Sequence](https://mermaid.live/edit#pako:eNq9Vs1u2zgQfpWBTvYmittDL0YTwE3qOECTGHZaX3yhpZHEDUWqJGXXKHrdB9hH3CfZISnF_0h7aH0RZM7PN_PNN-L3KFEpRv3I4NcaZYI3nOWalXMJ9KuYtjzhFZMWbnAJzLgHClWhht77he5dXQtWpwjXFOXQ53bkXG65HdULb91JvHnvL1hoJpOie-gzGzqfQW1VfI86R-83U_o5E2p1aH7PuHQOpXuGoIdGY5aj2UAJ74dmH7RaGaqMDD-7Z_N-pK7B1EdTKhcIg6oyHuU00byyh-bTAtGaLY_wx1wG0wdlEdSSElJzz8NZHy4vL-m9EmoNQ6rcvbcOZBZfXd2O-pBzC1VtCmj7GgxuR3Q-G_bhSfM8p8Crnf7Nhs3xdYHJMySqLCnOdDTwVSwNCGZsXGmVoDGYBicmLNzJAjW3mELHWCawu9Pxl9AO2Q0KpLLCOZk_8wpKx2dDOQqD8ICrJvteBMdqHzz_L6XBf__862nes3WFfK5SRtl2ccch9IUp2BGXULtrYMqzbGPg6hR8ibGhQuPKTUoPkoLJvO3ETig_Sv2WKauOjJgvV6a7KS5yAxmnWTgdmqasD0mtBYwfp0-QqrEytsMSy5W8TH3C7q4beTTtH6Kltgtqigm5lpy10Abju6NuLt0URRbXoZtnoDGkOVHHPtl74m6Idh6vDbqX-wQzjTTLn5SqoPOEZeXwwwcs2JIr3d2WgG8vZW8k6oDrJcLo6f4TOM6ClXCRPlLCNbx9AwYTJdMtUhrnDYuha4UtxQU5Gerzhf1md4n7Eg6O87aJuAWMJEpN4DKPjaplCplg-Sm3BsiEdixLtyppfyfqDowdcziGqKB1Mo9muHAjTrlYup5HXvuGWk4MnAE91-DhHuH-pyh1O9JPU6PNjkeq4ylPcYdKH4L2VGFBZeCnsFlbVNBi_bK7vArOPUxdSwPEQbNOjY_cEPuLGqBV2c7-BG2tpataJzTML1-0LXlcq5IWO8KXj5Pp3eMDLJnmbCFwsyJPjsdWlEdCu3J7FGhX_Y2J9ZvAwJkvLtHo-tUMIHHRyDFIsURpf5GFFtJYCUFT-Jq0dkRjoMMyS4HfvjPAJbecCUJC09F9VUe5Oa0ih2v5B5VEXePE228VlLsD_S41TWoqoES4YZYd3Ad-bhlugPsh9DccLonb8EWBDs_o4td-n8O4thBcVb0wstSX5nMaDvflszl3IbZRTahSykk7vlLSYHQe0YWAPugpXT-_zyNbYInzqD-PUsxYLew8-kE2jD4N07VMor7VNZ5HgZnmmhr-_PE_DdFqhQ) — *interactive editor with pan, zoom, and export*

```mermaid
sequenceDiagram
    participant Dev as Developer /<br/>Claude Code
    participant GH as GitHub<br/>(claude/* branch)
    participant WF as Auto-Merge<br/>Workflow
    participant Main as main branch
    participant Pages as GitHub Pages
    participant Browser as User Browser
    participant GAS as Google Apps<br/>Script
    participant Sheets as Google Sheets

    Note over Dev,Sheets: === Deploy Flow ===

    Dev->>GH: git push claude/*
    GH->>WF: Trigger workflow
    WF->>WF: Check commit SHA<br/>vs last-processed
    alt Inherited (stale) branch
        WF->>GH: Delete branch (skip merge)
    else New commit
        WF->>Main: Merge claude/* → main
        WF->>WF: Update last-processed-commit.sha
        WF->>WF: Check git diff
        alt live-site-pages/ changed
            WF->>Pages: Deploy to GitHub Pages
        end
        alt .gs file changed
            WF->>GAS: curl POST doPost(action=deploy)
            GAS->>GH: Fetch latest .gs via GitHub API
            GAS->>GAS: Self-update + redeploy
        end
        WF->>GH: Delete claude/* branch
    end

    Note over Dev,Sheets: === Auto-Refresh Loop (Template Behavior) ===

    Pages->>Browser: Serve HTML page
    loop Every 10 seconds
        Browser->>Pages: Fetch html.version.txt
        alt Version changed
            Browser->>Browser: Set pending-sound flag
            Browser->>Pages: Reload page
            Pages->>Browser: Serve updated page
            Browser->>Browser: Show "Website Ready"<br/>splash + play sound
        end
    end

    Note over Dev,Sheets: === GAS Self-Update (Server-Side) ===

    Note right of GAS: Triggered by workflow POST,<br/>runs on Google servers
    GAS->>GH: Fetch latest .gs via GitHub API
    GH-->>GAS: Return source code
    GAS->>GAS: Compare VERSION variable
    alt Version changed
        GAS->>GAS: Overwrite project files +<br/>create version + update deployment
    end

    Note over Dev,Sheets: === GAS Version Polling (Template Behavior) ===

    loop Every 10s (after 15s initial delay)
        Browser->>Pages: Fetch gs.version.txt
        alt GAS version changed
            Browser->>Browser: Set pending-sound flag
            Browser->>Pages: Reload entire page
            Pages->>Browser: Serve updated page
            Browser->>Browser: Show "Code Ready"<br/>splash + play sound
        end
    end

    Note over Dev,Sheets: === Runtime Data Flow ===

    Pages->>Browser: Serve HTML page
    Browser->>GAS: User interaction (iframe)
    GAS->>Sheets: Read/write data
    Sheets-->>GAS: Return data
    GAS-->>Browser: Render response
```

## 3. Template-Level Behaviors & Per-Environment Diagrams

The following behaviors are inherited by **all pages** via the HTML/GAS templates (`HtmlAndGasTemplateAutoUpdate-noauth.html.txt`/`HtmlAndGasTemplateAutoUpdate-auth.html.txt` and GAS script templates). They are documented here because they are template-level — they only change when the templates change, not when individual environments change.

### Template-Level State Diagram

> [Open in mermaid.live — Template State Diagram](https://mermaid.live/edit#pako:eNqVV8Fu4zYQ_ZWBDoXTjdMku7kIaYBsttkesrtGnHQPVRHQEmURK5MCSSUxgpwL9Nx7f7Gf0CEpiZQt2VsDiWVx3sxwOPNm-BKlIqNRHClNNP3AyFKS1fTxNOGAn4xJmmomONzcJty9s4KQRL_efbqB36hUZnkmypLxZRIBUVDoVQkvTtp8fv_xD5hOL-Ca6rRoEDHMyJJCKUgGE7Za0Yyh2gMPCoUtekakordU1aWOAb8rwRUF9I-yR5rtAP4ipZBz43XsFiEnrAwhXsICrkTNdSaeuLGTQSY0TE7VQRsAH4TKuPSQFjT9BufnaSFYSi8uvFTgslUcyHuhUIl1F3UvSqaK90RRDKrxmkmlIbe-T7iARbMCa6oPxjVdmadPhHFNOeEpKmpVAn1mSqtwR1tmnQpJcaMzVpYxzMkjhccmsG8gtUvAeMZSooX0qjxo0I3tOK7M4o44bmqwagOQlww1GaEA9AVdL8k6djKNorwkS_gZtKzpuBJrvsmoq4LwJR1UkpNS9Ta3bXxU3ZXgmvGaghZdiDe2xgVGSrJloUHkgxubF-JJgWhMPTFdgGYrijFeVUnC7ySrSjpNS4b7epKUYzahucW6Ikrh-nv7gEciJGY946CoMo7M8QXW6vaxNY7uO7jeVm0EekAv3de3UYltRdfotlGU7cL1TGYenLE8x0fIpVh1VRRurA-0uuZUf6WLOXqCivAHPNHFtKKY9nw5Vea1TQCvIwBYBbfUsFwMpwoyak5GF5Qj82HVoKkjaZcnPXrp9j3AmyfHCtJufaLsoZ9Nj82JIVU1fPC6SdcfL-fDbL3EvwGytkeHoGukyr1kHQpb9GdhbMSwVEfN6RzpZ21yGHIbmMm743e7FJhcxt-OeezbbcoKZCwGn78Sht3h5ExhNJhmpHQh95hGxscVX3ShvcNqkZBj01Mb_cRLtZb-VzvahtuWM9aP2vVW-LsbEp7lw_6q7HtvjWwBvfS2zm2vdhTnKHxPjYab25JuCxMXgsJEU_sKswW0TrS1eXJ09v3V6WJNkLEf1JqnYzHuF3En7mW8hsFsNIVuur0dtCosp4baq4MxFYj-YPZgwtmhMFrn8FYBWYqee43kiG0Mx8Qon1rlFclMVHtRcCVu4cgZMf6GylSiISR-iKVurRuaGSakmVB66uIP86okqoAfwB6O4yXl3o1R08wd9DWesAr4afOUTAbsa1ChKmvAg7xkoMiIGIa3DsYj_QC7px5FX-HM3cKHs3Yn_LNowRj03LptxT2gc8-NznjSbZ3g6cBSUszxJsCTE3WA49wjW0gMWNiDWh8HdSxKnFb2qOgwLslIRr_Uhp6x1JiBBrzcLG5s7-3x8QonmoqkTK-RJjMa5l_gHaZGuP3-rBS6br0RvFyDsY9tIsfJ57LOmDAjGMUexRTImnOTuAnOVxk82FOZuWrpxrzBnLaK4J4jfXxzWUzsm6EktkNyY3QwgXsSPvHtPWWbjlL9vC_P_Q2nE_YSHm9nFheBGC5L9CJbdyEZkZ_XyuSwIZ7uEcmL0gwHDJxAa0l75OGFbDFhR74W8qMTjOEGOz0mqJ1Uf9Kixhb5xjHg_WV7NbVZ3sP1Hb9X2Mob08jsGu-xYVtq5Dx9_fvP33_5y4xjsfGUCvaLwD-dOLY_zUr8b44fjSXcuOscp0jdazi1-Ty5KnD-bOen1-gwwrEDLxQZXsNfkggb0IomUZxEGc0JdugkMjKk1mKOZBzF5rZyGNVV5m_s7uXrf_q5GsM) — *interactive editor with pan, zoom, and export*

```mermaid
stateDiagram-v2
    direction LR

    state "HTML Version Polling" as html {
        [*] --> FetchVersion: Page load (immediate)
        FetchVersion --> ParseResult: Response received
        FetchVersion --> ErrorState: Fetch failed
        ErrorState --> Countdown: Red dot (2s)

        state parse_check <<choice>>
        ParseResult --> parse_check
        parse_check --> EstablishBaseline: First fetch (no baseline yet)
        parse_check --> CheckMaintenance: Baseline exists

        EstablishBaseline --> CreatePill: Save version + create indicator
        CreatePill --> CheckMaintenance

        state maint_check <<choice>>
        CheckMaintenance --> maint_check
        maint_check --> MaintenanceOverlay: maintenance flag = true
        maint_check --> CheckVersionChange: maintenance flag = false

        MaintenanceOverlay --> CheckVersionChange: Continue to version check
        note right of MaintenanceOverlay: Shows overlay with timestamp\nTriple-click wrench to bypass\nBypass stored in sessionStorage

        state version_check <<choice>>
        CheckVersionChange --> version_check
        version_check --> Countdown: Version unchanged
        version_check --> VersionChanged: Version differs from baseline

        VersionChanged --> SetWebSound: Set web-pending-sound flag
        SetWebSound --> Reload: 2s delay then location.reload()

        Countdown --> FetchVersion: 10s countdown (shows 5-0 in dot)
    }

    state "GAS Version Polling" as gas {
        [*] --> CheckGASFile: Page load (immediate)
        CheckGASFile --> NoPoll: gs.version.txt not found (404)
        CheckGASFile --> ShowGASPill: File exists

        ShowGASPill --> GASWait: 15s initial delay
        GASWait --> FetchGASVersion: Timer fires
        FetchGASVersion --> GASParseResult: Response received
        FetchGASVersion --> GASError: Fetch failed
        GASError --> GASCountdown: Red dot (2s)

        state gas_version_check <<choice>>
        GASParseResult --> gas_version_check
        gas_version_check --> GASCountdown: Version unchanged
        gas_version_check --> GASVersionChanged: Version differs

        GASVersionChanged --> SetGASSound: Set gas-pending-sound flag
        SetGASSound --> GASReload: 1.5s delay then location.reload()

        state anti_sync <<choice>>
        GASCountdown --> anti_sync
        anti_sync --> FetchGASVersion: 10s (no HTML poll overlap)
        anti_sync --> GASDelayed: HTML polled < 3s ago
        GASDelayed --> FetchGASVersion: 15s (anti-sync padding)

        NoPoll --> [*]: No pill shown, no polling
    }

    state "Post-Reload Splash & Sound" as splash {
        [*] --> CheckPendingFlags: Page load
        state flag_check <<choice>>
        CheckPendingFlags --> flag_check
        flag_check --> WebSplash: web-pending-sound flag set
        flag_check --> CodeSplash: gas-pending-sound flag set
        flag_check --> NoSplash: No flags set

        WebSplash --> PlaySound: Show green splash (1s) + vibrate
        CodeSplash --> PlaySound: Show blue splash (1s) + vibrate
        PlaySound --> FadeOut: 1s display
        FadeOut --> NoSplash: 300ms opacity fade
        NoSplash --> [*]

        note right of PlaySound: Sound only plays if\nAudioContext is running\nand _soundPlayed = false
    }

    state "Audio Unlock" as audio {
        [*] --> CreateContext: Page load
        CreateContext --> CheckState

        state ctx_check <<choice>>
        CheckState --> ctx_check
        ctx_check --> Running: Already running
        ctx_check --> Suspended: Suspended (needs gesture)

        Suspended --> WaitForGesture: Listen click/touch + poll UAv2
        WaitForGesture --> Running: User gesture detected
        Running --> [*]: 🔊 indicator shown

        note right of Suspended: 🔇 shown until unlocked\nUAv2 poll every 200ms (Chrome)
    }
```

### Per-Environment Diagrams

Environment-specific internals (page lifecycle states, maintenance mode, splash screens, environment-specific workflows) are documented in dedicated per-environment diagrams:

| Environment | Diagram |
|-------------|---------|
| GAS Project Creator | [`repository-information/diagrams/gas-project-creator-diagram.md`](diagrams/gas-project-creator-diagram.md) |
| Test Auth 1 | [`repository-information/diagrams/testauthgas1-diagram.md`](diagrams/testauthgas1-diagram.md) |
| Global ACL | [`repository-information/diagrams/globalacl-diagram.md`](diagrams/globalacl-diagram.md) |
| MasterACL | [`repository-information/diagrams/MasterACL-diagram.md`](diagrams/MasterACL-diagram.md) |


## 4. Git Graph — Branching Strategy

> [Open in mermaid.live — Git Graph](https://mermaid.live/edit#pako:eNqVks1qwzAQhF9l2XPSxu7Nt0JoEmih0N6qHjbSxhb-kVGkNibk3SsqN6QkMY5Al9nRDB_aPUqjGDPMtVtYagvRQDjS1LV2oFUGAleNdpqqXhQYLWtLjSxAVuQV32-YnLc8Tfr3BcvSeHdtfBr_NUvuZomFp-iBb2PLv5JjTk26iVLNNuez3D7r0TszjY6PbalbkPrzmHVaOue2Mh04A6-U81YguK7lDJarxfI53PchyHQYMr0GmVp4MYFQFtT8lt4GmQ5AwhhKGIe59vlG7y4z_pudAT6EX9Q7CKaxbDFvCGwc2QU0nGDICr0qrPdeoCu4ZoGZQMUb8lXY5EPwUCh96xqJmbOeJ-hbRY7nmnJLdRQPP43zCFQ) — *interactive editor with pan, zoom, and export*

```mermaid
gitGraph
    commit id: "Initial commit"
    branch claude/feature-1
    checkout claude/feature-1
    commit id: "v01.01r Feature work"
    checkout main
    merge claude/feature-1 id: "Auto-merge [skip ci]"
    commit id: "Deploy to Pages" type: HIGHLIGHT
    branch claude/feature-2
    checkout claude/feature-2
    commit id: "v01.02r More changes"
    checkout main
    merge claude/feature-2 id: "Auto-merge [skip ci] "
    commit id: "Deploy to Pages " type: HIGHLIGHT
    branch claude/bugfix
    checkout claude/bugfix
    commit id: "v01.03r Fix bug"
    checkout main
    merge claude/bugfix id: "Auto-merge [skip ci]  "
    commit id: "Deploy to Pages  " type: HIGHLIGHT
```

## 5. Architecture — System Topology (mermaid.live only)

> [Open in mermaid.live — Architecture](https://mermaid.live/edit#pako:eNp9UstugzAQ_BXLJ5CSH-CWh5QeGqlKWvUAOSx4A1YAo7WdKIry7zV2oKRSyml3dsY7HnzjhRLIEw5UVNJgYSzhPEcDWcvcV5KyHSPsVFTUyoo43UjzZnO2c5CWRtH1MGWWSpU1jlzfsVXfOVogaqSzLJAJPEeyNUgtmjhd4xlr1SEdnlk5QVtUkZD6FKerGqxAtvTYgcnWO3sWXBSdjrW6RD2AFKcLaxTbIpX4QtGAbB8Ltq78__gOStQT3484Pnr4haQEPZrZLPbsG3O26DrPDnk983WFaHQkwEAOGscY9x5_KctJXVw98fblWncbD4_xu9iTJZvP2WcSsg1wqIfJEGKYDd0w7QMLk74aUJ9MgH35u8Ub-HPUrh--Jy6bx_OBURDuP9jy4gmdz3iD5BYL92pvGTcVNpjxJOMCj2Brk_G744D76_trW_DEkMUZt53LE9cSSoImgPcfYI4D2A) — *interactive editor with pan, zoom, and export*
>
> *This diagram type (`architecture-beta`) is not supported by GitHub's mermaid renderer — use the link above to view it.*

## 6. C4 Context — System Boundaries (mermaid.live only)

> [Open in mermaid.live — C4 Context](https://mermaid.live/edit#pako:eNp1VMGO2jAQ_ZVRTrQCcemJG0uqZaVdFRGqvUSqnHgS3DW2ZTuwCK3Uj-gX9ks6trMBtoUL2J437_nNM6es1hyzWbb4stDK46svFdDHCy8RiqPzuIP-BP78-g2OibBnJPNorP6JtbdodKkSboXWaTXiuB9DmeW4R6kNWpjCQrKOI_XiWGbh8NkKjw4C_xhM57a08BrqWDf9DJVlqqbNMvv03j3p-XGnO8WZPY4Cc2h1L_yyq2BNSye8tkfCwClhzrjRQduXRupDgMw7rydNaFuE5347yVo8TBf5DHbhyJ3VCEXadkyoMXA0Uh8dGEYVY_BWtC1dG-7nBXSGkzFJ8wf2vnxQuwrrxLnUzjuQYo8T0o-TWDoF5sB55kUNYRcOwm-BBd0WG4tuC0ZLKVQ7sL3dMqrVupUYyeMvmobu-P9dapm7KJwb46CorTC-HxtWwIwB3FXIOXLYCwaisWxH_R3KZtJ7AI3VO-gvGzPyryl5NaK5o79kLOJGIsuZZ1Cx-gUVh0bb6LGLatzNW3999aPK6oNDG3p8p2-4S-vU9VEzPowveOhi7z0NUWgF9ZapeHTp9VUO1yhTxC8TtUoRroeAt8LHXA8hGhQH_Bk6BCNPwUro3rh57UmTuwHtZ7V5j2CKZmpQd1bC6luxucL2ZBf-FGj3pHu5eXrs07jZrIor0FDd8yUD09BvYWLpebhrJMj0kN485YMl3EW8YL56iB2ycUavj94ap_-lU5n5LQaaWZlxbFgnKYhvVBOmUxxVnc287XCcpdjlgrUkK22-_QUoHp5t) — *interactive editor with pan, zoom, and export*
>
> *This diagram type (`C4Context`) is not supported by GitHub's mermaid renderer — use the link above to view it.*

## 7. Mindmap — Concept Hierarchy

> [Open in mermaid.live — Mindmap](https://mermaid.live/edit#pako:eNp1VU2P2jAU_CtWKsRWWlp2QSrihqDaRdpKq4ZuL1wc-yVY-EvPDi1C_PfaIRUkIZY4MDN-tueNnVPCDIdkngwGJ6GFn5PT0O9AwXA-zKiD4SO5_P-gKGgmwQ2jxKJQFI9LIw0GYPjpW0YnfBrVNbWBv_5Kj6sRaZYyKmFcoTDLptnsij5VaDbjU7hBn2sUZuwGndQVeKPCtEIjdlvhjWYgx3c3UlFP_dRzPzXpp6Z3qbU-jPuIpz7iuY-Y9BGNxc_n82Cw1UporqjdahIGGuMfHtKj86DIAtlOeGC-RPj8-SKIYwVWmqMC7a9YHC_Cv5YZeacFuCYTx6L0ZoSQI7gdsUZKoYuu6gPQCaNHMWCcIEhDeVeVmlJzoo0XuWDUhwmtBZfrr8sV-W1wn0vzp2czCrAAwiQtOZAMqWa7extPfTCv5gmHaEhYsKurzh0E0Zwu-7JIa454FEUBeNW8GFOEJRbWOpIyFLZlbAoyH5WWUw8kR6Nqp1tHNjoXxYijOIAmDnxpW1UsAuVuB-BJRtkedMvZdY5UAQGVAeeN7tRd6XTsJ1jjhDd4JIeLhIwINjXRlhu21Yxoy5VslV_uqC5CBApHLCDJhYSmoEroAUJsPW02ZQWHMDHO2hgj2-l4W_xaff-iOBHaeSzZnQS9I4yYUUp4EmLB9lI431XYMoS5h0_BVcdiRvvw4rWdi_cuHPwKb0BZGVt8uX5N_evmxxux0Upfy7o-uio6PYJ1eMH_K3KD8bd37Q2HzNxqQtHkMQnXRFHBw4fgtE2qB3-bzLcJh5yW0m-Tc9DQcJ_So2bJPNgJj8klrCtBixCpC3j-B8UWx9w) — *interactive editor with pan, zoom, and export*

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor': '#7ba3d4', 'primaryTextColor': '#000000', 'cScale0': '#e8b4b8', 'cScale1': '#b8d4e8', 'cScale2': '#b8e8c8', 'cScale3': '#e8d4b8', 'cScale4': '#d4b8e8', 'cScaleLabel0': '#000000', 'cScaleLabel1': '#000000', 'cScaleLabel2': '#000000', 'cScaleLabel3': '#000000', 'cScaleLabel4': '#000000', 'cScaleInv0': '#000000', 'cScaleInv1': '#000000', 'cScaleInv2': '#000000', 'cScaleInv3': '#000000', 'cScaleInv4': '#000000'}}}%%
mindmap
    root((System Architecture))
        Deployment
            GitHub Pages
                Auto-refresh polling
                Version-based reload
                Sound notifications
            CI/CD Workflow
                Auto-merge claude branches
                Stale branch detection
                Pages deploy
                GAS deploy trigger
        Google Apps Script
            Self-update from GitHub
            Config-driven setup
            Spreadsheet backend
            Iframe embedding
        Versioning
            Repository version - r
            Page version - w
            GAS version - g
            Changelogs per file
            Archive rotation
        Developer Tools
            CLAUDE.md instructions
            Pre-commit checklist
            Pre-push checklist
            Session context
            Reminders
        Template System
            HTML page template
            GAS script template
            Init script for forks
            Setup script for GAS
```

## 8. Entity Relationship — File Dependencies

> [Open in mermaid.live — ER Diagram](https://mermaid.live/edit#pako:eNqNVV2PojAU_SsNTzPJ6MxksvvgG5GushE0wJrdxIRUuGKzSElbnBj1v2_5cKzAGnm83HPPPefetkcjYjEYIwO4RUnCyW6VIfVNA2cWLswJRqfTYHA61YEl9nx77obB7wCN0MrYAxeUZUhyEv2FGK0PK-Mefjw13QmezScVOtqSLAGBUpYkCkyzfjA7oYnph_7Ysxc1LezWEAu0pwTRjWoZboBXkl7q0PTGU3uJq0qcSSJVC5KVJeoiGllToIw8Lr0f_6D0_4Dn7g97Ev70524NZ9mGJgXv8Ha03wQfkq5z6QZW8yiB4pBFCkZlCg34DrQ1uRq7J_yW18OL-Y3DDfrWtIvlghU8ArRh_ELekf2I5HvEHjYtB4eOVeFiKvKUHL4GpS1bgJ3FzAyaTT22rIo4VIQZfOo-tUEtk1qoGofdZWjZ5sQzHXTuG0vMomIHmRSqSQk8I6lAbNNqt8o-1oHyE5LTLEHrgqbx4OLvytiBJEiSBD3RTNm8I1LFSfp8EaFB6wM4EDxSOCUExZCn7FB2gn55swvirDWh-93t5doFDJMh2r-9D98_PtGTUD_VxjXDZxt18gq5fW4RaFZ2SzfEeum3b0mPKAsvZvM_DnaD0LZUupnnAvkRp7ls9CHb6mHWD0CXPrCDGVbVcpJAfX4eoL5aqlFq-f6i3FV_inEDiIma3bq8lLK4L7_KdE2n7EQSnoBEYgsgW3I6J-OhSX3_4K06-t52S6QsqnarPJyQM0El44eBtnSvcf0qidevusaL2k_1m8bq2ToqEVsoX4CRkg4bUqRKSZlDCsl8dd0YI7Uo8GIUuXIGmkeuDp7_AVo1I1o) — *interactive editor with pan, zoom, and export*

```mermaid
erDiagram
    HTML_PAGE ||--|| HTML_VERSION_TXT : "version tracked by"
    HTML_PAGE ||--|| HTML_CHANGELOG : "changes logged in"
    HTML_PAGE ||--o| GAS_SCRIPT : "embeds via iframe"
    HTML_CHANGELOG ||--|| HTML_CHANGELOG_ARCHIVE : "rotates to"

    GAS_SCRIPT ||--|| GAS_VERSION_TXT : "version tracked by"
    GAS_SCRIPT ||--|| GAS_CHANGELOG : "changes logged in"
    GAS_SCRIPT ||--|| GAS_CONFIG_JSON : "configured by"
    GAS_CHANGELOG ||--|| GAS_CHANGELOG_ARCHIVE : "rotates to"

    GAS_CONFIG_JSON ||--|| HTML_PAGE : "syncs title to"
    GAS_CONFIG_JSON ||--|| GAS_SCRIPT : "syncs vars to"

    REPO_VERSION_TXT ||--|| CHANGELOG : "version source for"
    CHANGELOG ||--|| CHANGELOG_ARCHIVE : "rotates to"
    REPO_VERSION_TXT ||--|| README_MD : "displayed in"

    HTML_TEMPLATE ||--o{ HTML_PAGE : "creates new"
    GAS_TEMPLATE ||--o{ GAS_SCRIPT : "creates new"

    ENV_DIAGRAM }|--|| HTML_PAGE : "documents internals of"

    HTML_PAGE {
        string build-version "meta tag (informational)"
        string iframe-src "GAS deployment URL"
    }
    HTML_VERSION_TXT {
        string version "e.g. v01.13w (single source of truth)"
    }
    GAS_SCRIPT {
        string VERSION "e.g. v01.05g"
        string DEPLOYMENT_ID "Apps Script deploy ID"
    }
    GAS_CONFIG_JSON {
        string TITLE "page title"
        string DEPLOYMENT_ID "GAS deploy ID"
        string SPREADSHEET_ID "data backend"
        string SHEET_NAME "target sheet"
    }
    REPO_VERSION_TXT {
        string version "e.g. v01.63r"
    }
    ENV_DIAGRAM {
        string location "repository-information/diagrams/"
    }
```

## 9. Class Diagram — Component Model

> [Open in mermaid.live — Class Diagram](https://mermaid.live/edit#pako:eNqtVU1v2zAM_SuCTvtojO3qQwGvcdMCSRvUQYdhHgRFYmyhsmToI13Q9r8Xjh3Hjt12h-Wk8PGRTyRFP2GmOeAQM0mtnQqaGVqkCiGE9hZ0tVrMlzQD9FRbq9_XxBmhMrT2QvLJFowVWg1hsTG0gIk1rIOVWkrSUD597gDUO00MbAzYvAfYXD8SW0p6Yi8l3RGrveIH80tX-CxKEmZE6caU38d3yfXtzRCYxsv57a9FfLMi19MhnCzv4miaXMXxCc71DFxPHtdLbfum0ksZKT6FUurdpdHFTLgrv35L_oVWG5GNyV9dr-bx_xN_wPfITbSIR_Tc1y27FHJ0FIZD4IzIMjCWGJCajvfoIqcqA6lPLgnMCa1-_0FeGZBALfBRuElqO6DRjjogThNqWC62MJo38k4vwGTwU5uHjdSPvfwsB_ZAbE57zSsqf7I2VLH-HPJ9O0lJM7A9oKkAyagltdMJT4I7jdiTuYKilNSNFtxqbxiQ6vV2J8zokmZNBXqKeoFjtRVGqwKUa578WAqpGXX9pnLNfMWyRCgHRlHZTVAf2o2R4u8pRpPJeXPqjlCIclfIoOlg4P66d8jfgqD6c3zRIYJiDdyiraDNmqnps_ntj2geXczJMprFaBJMzp9TPHTGz1U00rrX7EWUrOK7f2a37h_c-zjl9a0ROxg-II60KURt4dGhGcCRaGp_LNH7xc_ssPRvc7sXyOyp_Ld5xx0WIrY_eAMcrXctsYFr9yA4ENuKhMjuFLPICSebFrePokv60icxA9SB_YDQnaceY7geKlInfv2a3_XuBj-sQuRLTh3gM1yAKajgOMRPKXY5VEMVppjDhnrpUvyCz3D1QUx2iuHQGQ9nuCY3g1AbX14BQyRZhw) — *interactive editor with pan, zoom, and export*

```mermaid
classDiagram
    class HTMLPage {
        +String build-version
        +String iframe-src
        +poll_version()
        +auto_refresh()
        +show_splash()
        +play_sound()
    }
    class GASScript {
        +String VERSION
        +String DEPLOYMENT_ID
        +String SPREADSHEET_ID
        +doGet()
        +doPost()
        +pullAndDeployFromGitHub()
    }
    class GASConfig {
        +String TITLE
        +String DEPLOYMENT_ID
        +String SPREADSHEET_ID
        +String SHEET_NAME
    }
    class VersionFile {
        +String version
        +triggers_reload()
    }
    class Changelog {
        +Section[] unreleased
        +Section[] versions
        +rotate_to_archive()
    }
    class AutoMergeWorkflow {
        +check_sha()
        +merge_branch()
        +deploy_pages()
        +trigger_gas_deploy()
        +delete_branch()
    }
    class Template {
        +String source_code
        +propagate_to_pages()
    }
    class EnvironmentDiagram {
        +String location
        +documents_internals()
    }

    HTMLPage "1" --> "1" VersionFile : html.version.txt
    HTMLPage "1" --> "0..1" GASScript : embeds via iframe
    GLOBALACL_PAGE -.->|"embeds via iframe"| GAS_GLOBALACL
    MASTERACL_PAGE -.->|"embeds via iframe"| GAS_MASTERACL
    HTMLPage "1" --> "1" Changelog : html changelog
    HTMLPage "1" --> "1" EnvironmentDiagram : internals documented in
    GASScript "1" --> "1" VersionFile : gs.version.txt
    GASScript "1" --> "1" Changelog : gs changelog
    GASScript "1" --> "1" GASConfig : configured by
    GASConfig "1" ..> "1" HTMLPage : syncs title
    Template "1" ..> "*" HTMLPage : creates
    Template "1" ..> "*" GASScript : creates
    AutoMergeWorkflow ..> HTMLPage : deploys
    AutoMergeWorkflow ..> GASScript : triggers update
```

Developed by: LightAISolutions
