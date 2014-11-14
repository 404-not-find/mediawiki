<?php

/**
 * Accepts a list of files and directories to search for
 * php files and generates $wgAutoloadLocalClasses or $wgAutoloadClasses
 * lines for all detected classes. These lines are written out
 * to an autoload.php file in the projects provided basedir.
 *
 * Usage:
 *
 *     $gen = new AutoloadGenerator( __DIR__ );
 *     $gen->readDir( __DIR__ . '/includes' );
 *     $gen->readFile( __DIR__ . '/foo.php' )
 *     $gen->generateAutoload();
 */
class AutoloadGenerator {
	/**
	 * @var string Root path of the project being scanned for classes
	 */
	protected $basepath;

	/**
	 * @var ClassCollector Helper class extracts class names from php files
	 */
	protected $collector;

	/**
	 * @var array Map of file shortpath to list of FQCN detected within file
	 */
	protected $classes = array();

	/**
	 * @var string The global variable to write output to
	 */
	protected $variableName = 'wgAutoloadClasses';

	/**
	 * @var array Map of FQCN to relative path(from self::$basepath)
	 */
	protected $overrides = array();

	/**
	 * @param string $basepath Root path of the project being scanned for classes
	 * @param array|string $flags
	 *
	 *  local - If this flag is set $wgAutoloadLocalClasses will be build instead
	 *          of $wgAutoloadClasses
	 */
	public function __construct( $basepath, $flags = array() ) {
		if ( !is_array( $flags ) ) {
			$flags = array( $flags );
		}
		$this->basepath = realpath( $basepath );
		$this->collector = new ClassCollector;
		if ( in_array( 'local', $flags ) ) {
			$this->variableName = 'wgAutoloadLocalClasses';
		}
	}

	/**
	 * Force a class to be autoloaded from a specific path, regardless of where
	 * or if it was detected.
	 *
	 * @param string $fqcn FQCN to force the location of
	 * @param string $inputPath Full path to the file containing the class
	 */
	public function forceClassPath( $fqcn, $inputPath ) {
		$path = realpath( $inputPath );
		if ( !$path ) {
			throw new \MWException( "Invalid path: $inputPath" );
		}
		$len = strlen( $this->basepath );
		if ( substr( $path, 0, $len ) !== $this->basepath ) {
			throw new \MWException( "Path is not within basepath: $inputPath" );
		}
		$shortpath = substr( $path, $len );
		$this->overrides[$fqcn] = $shortpath;
	}

	/**
	 * @var string $inputPath Path to a php file to find classes within
	 */
	public function readFile( $inputPath ) {
		$path = realpath( $inputPath );
		if ( !$path ) {
			throw new \MWException( "Invalid path: $inputPath" );
		}
		$len = strlen( $this->basepath );
		if ( substr( $path, 0, $len ) !== $this->basepath ) {
			throw new \MWException( "Path is not within basepath: $inputPath" );
		}
		$result = $this->collector->getClasses(
			file_get_contents( $path )
		);
		if ( $result ) {
			$shortpath = substr( $path, $len );
			$this->classes[$shortpath] = $result;
		}
	}

	/**
	 * @param string $dir Path to a directory to recursively search
	 *  for php files with either .php or .inc extensions
	 */
	public function readDir( $dir ) {
		$it = new RecursiveDirectoryIterator( realpath( $dir ) );
		$it = new RecursiveIteratorIterator( $it );

		foreach ( $it as $path => $file ) {
			$ext = pathinfo( $path, PATHINFO_EXTENSION );
			// some older files in mw use .inc
			if ( $ext === 'php' || $ext === 'inc' ) {
				$this->readFile( $path );
			}
		}
	}

	/**
	 * Write out all known classes to autoload.php in
	 * the provided basedir
	 */
	public function generateAutoload() {
		$content = array();

		// We need to generate a line each rather than exporting the
		// full array so __DIR__ can be prepended to all the paths
		$format = "%s => __DIR__ . %s,";
		foreach ( $this->classes as $path => $contained ) {
			$exportedPath = var_export( $path, true );
			foreach ( $contained as $fqcn ) {
				$content[$fqcn] = sprintf(
					$format,
					var_export( $fqcn, true ),
					$exportedPath
				);
			}
		}

		foreach ( $this->overrides as $fqcn => $path ) {
			$content[$fqcn] = sprintf(
				$format,
				var_export( $fqcn, true ),
				var_export( $path, true )
			);
		}

		// sort for stable output
		ksort( $content );

		$output = implode( "\n\t", $content );
		file_put_contents(
			$this->basepath . '/autoload.php',
			<<<EOD
<?php
// This file is generated, do not adjust manually

global \${$this->variableName};

\${$this->variableName} = array(
	{$output}
);
EOD
		);
	}
}

/**
 * Reads PHP code and returns the FQCN of every class defined within it.
 */
class ClassCollector {

	/**
	 * @var string Current namespace
	 */
	protected $namespace = '';

	/**
	 * @var array List of FQCN detected in this pass
	 */
	protected $classes;

	/**
	 * @var array Token from token_get_all() that started an expect sequence
	 */
	protected $startToken;

	/**
	 * @var array List of tokens that are members of the current expect sequence
	 */
	protected $tokens;

	/**
	 * @var string $code PHP code (including <?php) to detect class names from
	 * @return array List of FQCN detected within the tokens
	 */
	public function getClasses( $code ) {
		$this->namespace = '';
		$this->classes = array();
		$this->startToken = null;
		$this->tokens = array();

		foreach ( token_get_all( $code ) as $token ) {
			if ( $this->startToken === null ) {
				$this->tryBeginExpect( $token );
			} else {
				$this->tryEndExpect( $token );
			}
		}

		return $this->classes;
	}

	/**
	 * Determine if $token begins the next expect sequence.
	 *
	 * @param array $token
	 */
	protected function tryBeginExpect( $token ) {
		if ( is_string( $token ) ) {
			return;
		}
		switch( $token[0] ) {
		case T_NAMESPACE:
		case T_CLASS:
		case T_INTERFACE:
			$this->startToken = $token;
		}
	}

	/**
	 * Accepts the next token in an expect sequence
	 *
	 * @param array
	 */
	protected function tryEndExpect( $token ) {
		switch( $this->startToken[0] ) {
		case T_NAMESPACE:
			if ( $token === ';' || $token === '{' ) {
				$this->namespace = $this->implodeTokens() . '\\';
			} else {
				$this->tokens[] = $token;
			}
			break;

		case T_CLASS:
		case T_INTERFACE:
			$this->tokens[] = $token;
			if ( is_array( $token ) && $token[0] === T_STRING ) {
				$this->classes[] = $this->namespace . $this->implodeTokens();
			}
		}
	}

	/**
	 * Returns the string representation of the tokens within the
	 * current expect sequence and resets the sequence.
	 *
	 * @return string
	 */
	protected function implodeTokens() {
		$content = array();
		foreach ( $this->tokens as $token ) {
			$content[] = is_string( $token ) ? $token : $token[1];
		}

		$this->tokens = array();
		$this->startToken = null;

		return trim( implode( '', $content ), " \n\t" );
	}
}
