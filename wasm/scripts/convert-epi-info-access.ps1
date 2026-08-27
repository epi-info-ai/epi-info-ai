[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InputMdb,

    [Parameter(Mandatory = $true)]
    [string]$OutputPackage
)

$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $InputMdb).Path
$outputPath = [System.IO.Path]::GetFullPath($OutputPackage)
$outputDirectory = [System.IO.Path]::GetDirectoryName($outputPath)
if (-not [System.IO.Directory]::Exists($outputDirectory)) {
    [void][System.IO.Directory]::CreateDirectory($outputDirectory)
}

function Convert-CellValue {
    param([object]$Value)
    if ($null -eq $Value -or $Value -is [System.DBNull]) { return $null }
    if ($Value -is [datetime]) { return $Value.ToString('yyyy-MM-ddTHH:mm:ss.fffK', [Globalization.CultureInfo]::InvariantCulture) }
    if ($Value -is [guid]) { return $Value.ToString() }
    if ($Value -is [byte[]]) { return [Convert]::ToBase64String($Value) }
    if ($Value -is [decimal]) { return [double]$Value }
    return $Value
}

function Convert-NullableInteger {
    param([object]$Value)
    if ($null -eq $Value -or $Value -is [System.DBNull]) { return $null }
    return [int]$Value
}

function Convert-Boolean {
    param([object]$Value, [bool]$Default = $false)
    if ($null -eq $Value -or $Value -is [System.DBNull]) { return $Default }
    return [bool]$Value
}

function Convert-OptionalText {
    param([object]$Value)
    if ($null -eq $Value -or $Value -is [System.DBNull]) { return $null }
    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return $text
}

function Read-Table {
    param([System.Data.OleDb.OleDbConnection]$Connection, [string]$Name)
    $escaped = $Name.Replace(']', ']]')
    $command = $Connection.CreateCommand()
    $command.CommandText = "SELECT * FROM [$escaped]"
    $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($command)
    $table = New-Object System.Data.DataTable
    [void]$adapter.Fill($table)
    return ,$table
}

function Convert-Rows {
    param([System.Data.DataTable]$Table)
    $rows = [System.Collections.Generic.List[object]]::new()
    foreach ($row in $Table.Rows) {
        $item = [ordered]@{}
        foreach ($column in $Table.Columns) {
            $item[$column.ColumnName] = Convert-CellValue $row[$column.ColumnName]
        }
        $rows.Add($item)
    }
    return @($rows)
}

function Convert-LegacyField {
    param([System.Data.DataRow]$Row)
    $field = [ordered]@{
        id = [int]$Row['FieldId']
        name = [string]$Row['Name']
        prompt = if ($Row['PromptText'] -is [System.DBNull]) { '' } else { [string]$Row['PromptText'] }
        sourceTypeId = [int]$Row['FieldTypeId']
        pageId = Convert-NullableInteger $Row['PageId']
        tabIndex = Convert-NullableInteger $Row['TabIndex']
        required = Convert-Boolean $Row['IsRequired']
        readOnly = Convert-Boolean $Row['IsReadOnly']
        tabStop = Convert-Boolean $Row['HasTabStop'] $true
    }
    $before = Convert-OptionalText $Row['CheckCodeBefore']
    $after = Convert-OptionalText $Row['CheckCodeAfter']
    if ($null -ne $before) { $field.checkCodeBefore = $before }
    if ($null -ne $after) { $field.checkCodeAfter = $after }
    return $field
}

function Get-BrowserFieldType {
    param([int]$SourceTypeId)
    switch ($SourceTypeId) {
        1 { 'text' }
        3 { 'text-uppercase' }
        4 { 'multiline' }
        5 { 'number' }
        6 { 'phone' }
        7 { 'date' }
        8 { 'time' }
        9 { 'text' }
        10 { 'checkbox' }
        11 { 'yes-no' }
        12 { 'option' }
        17 { 'option' }
        18 { 'option' }
        19 { 'option' }
        23 { 'unique-id' }
        25 { 'unique-id' }
        27 { 'option' }
        default { $null }
    }
}

$connection = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$sourcePath;Mode=Read;")
try {
    $connection.Open()
    $views = Read-Table $connection 'metaViews'
    $pages = Read-Table $connection 'metaPages'
    $fields = Read-Table $connection 'metaFields'
    $programRows = Read-Table $connection 'metaPrograms'
    $schema = $connection.GetSchema('Tables')

    $projectForms = [System.Collections.Generic.List[object]]::new()
    $legacyForms = [System.Collections.Generic.List[object]]::new()
    foreach ($view in ($views.Select('', 'ViewId ASC'))) {
        $viewId = [int]$view['ViewId']
        $viewName = [string]$view['Name']
        $viewFields = @($fields.Select("ViewId = $viewId", 'TabIndex ASC, FieldId ASC'))
        $browserFields = [System.Collections.Generic.List[object]]::new()
        foreach ($field in $viewFields) {
            $browserType = Get-BrowserFieldType ([int]$field['FieldTypeId'])
            if ($null -eq $browserType) { continue }
            $prompt = if ($field['PromptText'] -is [System.DBNull] -or [string]::IsNullOrWhiteSpace([string]$field['PromptText'])) { [string]$field['Name'] } else { [string]$field['PromptText'] }
            $item = [ordered]@{
                name = [string]$field['Name']
                prompt = $prompt
                type = $browserType
                required = Convert-Boolean $field['IsRequired']
                tabStop = Convert-Boolean $field['HasTabStop'] $true
            }
            if ($field['ControlLeftPositionPercentage'] -isnot [System.DBNull]) { $item.x = [math]::Round([double]$field['ControlLeftPositionPercentage'] * 720, 2) }
            if ($field['ControlTopPositionPercentage'] -isnot [System.DBNull]) { $item.y = [math]::Round([double]$field['ControlTopPositionPercentage'] * 900, 2) }
            $browserFields.Add($item)
        }

        $recordTableEntry = $schema | Where-Object { $_.TABLE_TYPE -eq 'TABLE' -and $_.TABLE_NAME -ieq $viewName } | Select-Object -First 1
        $records = @()
        if ($null -ne $recordTableEntry) {
            $records = Convert-Rows (Read-Table $connection ([string]$recordTableEntry.TABLE_NAME))
        }
        $projectForms.Add([ordered]@{
            id = "legacy-view-$viewId"
            schema = [ordered]@{ name = $viewName; fields = @($browserFields) }
            records = @($records)
        })

        $legacyPages = [System.Collections.Generic.List[object]]::new()
        foreach ($page in ($pages.Select("ViewId = $viewId", 'Position ASC, PageId ASC'))) {
            $pageId = [int]$page['PageId']
            $pageFields = @($viewFields | Where-Object { $_['PageId'] -isnot [System.DBNull] -and [int]$_['PageId'] -eq $pageId } | ForEach-Object { Convert-LegacyField $_ })
            $legacyPage = [ordered]@{
                id = $pageId
                name = [string]$page['Name']
                position = [int]$page['Position']
                fields = $pageFields
            }
            $pageBefore = Convert-OptionalText $page['CheckCodeBefore']
            $pageAfter = Convert-OptionalText $page['CheckCodeAfter']
            if ($null -ne $pageBefore) { $legacyPage.checkCodeBefore = $pageBefore }
            if ($null -ne $pageAfter) { $legacyPage.checkCodeAfter = $pageAfter }
            $legacyPages.Add($legacyPage)
        }
        $unpagedFields = @($viewFields | Where-Object { $_['PageId'] -is [System.DBNull] } | ForEach-Object { Convert-LegacyField $_ })
        $legacyForm = [ordered]@{
            id = $viewId
            name = $viewName
            related = Convert-Boolean $view['IsRelatedView']
            pages = @($legacyPages)
            unpagedFields = $unpagedFields
        }
        $viewCheckCode = Convert-OptionalText $view['CheckCode']
        if ($null -ne $viewCheckCode) { $legacyForm.checkCode = $viewCheckCode }
        $legacyForms.Add($legacyForm)
    }

    $programs = @($programRows.Rows | ForEach-Object {
        $program = [ordered]@{
            name = [string]$_['Name']
            source = [string]$_['Content']
            language = 'classic-analysis'
        }
        $author = Convert-OptionalText $_['Author']
        if ($null -ne $author) { $program.author = $author }
        if ($_['DateModified'] -isnot [System.DBNull]) { $program.modifiedAt = ([datetime]$_['DateModified']).ToString('yyyy-MM-ddTHH:mm:ss', [Globalization.CultureInfo]::InvariantCulture) }
        $program
    })

    $codeTables = [System.Collections.Generic.List[object]]::new()
    foreach ($entry in ($schema | Where-Object { $_.TABLE_TYPE -eq 'TABLE' -and $_.TABLE_NAME -like 'code*' } | Sort-Object TABLE_NAME)) {
        $table = Read-Table $connection ([string]$entry.TABLE_NAME)
        $codeTables.Add([ordered]@{
            name = [string]$entry.TABLE_NAME
            columns = @($table.Columns | ForEach-Object { $_.ColumnName })
            rows = @(Convert-Rows $table)
        })
    }

    $sourceInfo = Get-Item -LiteralPath $sourcePath
    $oswego = $projectForms | Where-Object { $_.schema.name -eq 'Oswego' } | Select-Object -First 1
    $currentFormId = if ($null -ne $oswego) { $oswego.id } else { $projectForms[0].id }
    $package = [ordered]@{
        format = 'epi-info-ai-project'
        version = 2
        exportedAt = $sourceInfo.LastWriteTimeUtc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        project = [ordered]@{
            version = 1
            name = 'Sample'
            currentFormId = $currentFormId
            storage = [ordered]@{ type = 'browser' }
            forms = @($projectForms)
        }
        programs = $programs
        codeTables = @($codeTables)
        migration = [ordered]@{
            sourceFormat = 'epi-info-access'
            sourceName = $sourceInfo.Name
            inventory = [ordered]@{
                forms = $views.Rows.Count
                pages = $pages.Rows.Count
                fields = $fields.Rows.Count
                programs = $programRows.Rows.Count
                codeTables = $codeTables.Count
            }
            forms = @($legacyForms)
            findings = @(
                [ordered]@{ feature = 'Forms, records, and layout'; disposition = 'adapted'; detail = 'Supported entry fields and records are available in the browser projection; complete legacy metadata remains in migration.forms.' },
                [ordered]@{ feature = 'Classic Analysis program source'; disposition = 'preserved'; detail = 'Saved program source is retained verbatim. Execution support is command-gated.' },
                [ordered]@{ feature = 'Code tables'; disposition = 'preserved'; detail = 'All code tables, columns, and rows are retained in the package.' },
                [ordered]@{ feature = 'Check Code'; disposition = 'preserved'; detail = 'Legacy source is retained as migration metadata; only the typed browser-safe subset executes.' },
                [ordered]@{ feature = 'EXECUTE and desktop process access'; disposition = 'blocked'; detail = 'Arbitrary process and filesystem execution is not allowed in the browser.' }
            )
        }
    }

    $json = $package | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
    Write-Output "Created $outputPath"
    Write-Output "Forms=$($views.Rows.Count) Pages=$($pages.Rows.Count) Fields=$($fields.Rows.Count) Programs=$($programRows.Rows.Count) CodeTables=$($codeTables.Count)"
}
finally {
    if ($connection.State -ne [System.Data.ConnectionState]::Closed) { $connection.Close() }
    $connection.Dispose()
}
